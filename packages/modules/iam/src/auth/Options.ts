import { expo } from "@better-auth/expo";
import { sso } from "@better-auth/sso";
import { renderEmail } from "@vantion/emails/Render";
import { EmailOtp } from "@vantion/emails/templates/EmailOtp";
import { Invitation } from "@vantion/emails/templates/Invitation";
import { MagicLink } from "@vantion/emails/templates/MagicLink";
import { ResetPassword } from "@vantion/emails/templates/ResetPassword";
import { VerifyEmail } from "@vantion/emails/templates/VerifyEmail";
import type { EmailMessage } from "@vantion/module-notifications/Mailer";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { emailOTP, magicLink, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import type * as Pg from "pg";
import { grantsFor, statements } from "../identity/Permission.js";

/**
 * Everything better-auth needs, resolved before it is constructed.
 *
 * This module imports nothing from `effect` on purpose: the Effect boundary
 * lives in `Auth.ts`, and `sendEmail` arrives already bound to a runtime.
 */
export interface MakeAuthOptions {
  readonly pool: Pg.Pool;
  /** What the emails call this product. */
  readonly product: string;
  /** Where an invitation link points. The web app, not the API. */
  readonly webUrl: string;
  /**
   * How many members the organization's plan allows.
   *
   * A function rather than a number because it is a property of the
   * subscription, and better-auth asks per invitation rather than once at
   * startup — which is what makes an upgrade take effect immediately.
   */
  readonly seatsFor: (organizationId: string) => Promise<number>;
  /**
   * Whether the organization's plan carries single sign-on.
   *
   * Separate from `seatsFor` because it answers a different question and is
   * asked at a different moment — before a provider may be registered, rather
   * than before a seat is filled. Like the seat limit it is a function rather
   * than a value, so an upgrade takes effect on the next request.
   */
  readonly ssoEntitled: (organizationId: string) => Promise<boolean>;
  readonly baseURL: string;
  readonly secret: string;
  readonly trustedOrigins: ReadonlyArray<string>;
  readonly google: { readonly clientId: string; readonly clientSecret: string; } | undefined;
  /**
   * The parent domain the session cookie is scoped to, when the web app and the
   * API are on different subdomains of it — `.example.com` for `app.example.com`
   * and `api.example.com`.
   *
   * Undefined leaves better-auth's default, which is right whenever the two are
   * the same host: `localhost` in development, or a single-origin deployment.
   */
  readonly cookieDomain: string | undefined;
  readonly sendEmail: (message: EmailMessage) => Promise<void>;
}

/** What a verified session carries. Narrower than better-auth's own shape. */
export interface AuthSession {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly emailVerified: boolean;
  };
  readonly session: {
    readonly id: string;
    readonly activeOrganizationId?: string | null | undefined;
    readonly role?: string | null | undefined;
    readonly memberId?: string | null | undefined;
  };
}

/**
 * The only surface the rest of the server sees.
 *
 * Deliberately narrow: better-auth's inferred types are not portable across a
 * `declaration: true` build — they reach into zod internals that pnpm's store
 * layout makes unnameable — and letting them escape would leak its whole type
 * surface into every consumer. `authOptions` stays unexported for that reason.
 */
export interface AuthInstance {
  readonly handler: (request: Request) => Promise<Response>;
  readonly getSession: (headers: Record<string, string>) => Promise<AuthSession | null>;
}

/**
 * better-auth's access control, generated from the domain's permission
 * declaration rather than written a second time here.
 *
 * This is what stops the two systems disagreeing: its endpoints and our RPC
 * policies now consult the same grants, and a change to `grantsFor` moves both.
 */
const accessControl = createAccessControl(statements);

const roles = {
  owner: accessControl.newRole(grantsFor.owner),
  admin: accessControl.newRole(grantsFor.admin),
  member: accessControl.newRole(grantsFor.member),
};

/**
 * Renders a template and hands it to the mailer.
 *
 * better-auth's callbacks are plain async functions, so the render — which is
 * asynchronous, because that is what `@react-email/render` is — is run here
 * rather than threaded through as an Effect.
 */
const send = async <Props>(
  options: MakeAuthOptions,
  to: string,
  template: Parameters<typeof renderEmail<Props>>[0],
  props: Props,
) => {
  await options.sendEmail({ to, ...(await Effect.runPromise(renderEmail(template, props))) });
};

/** Single source of truth for the runtime instance and for schema generation. */
const authOptions = (options: MakeAuthOptions) => ({
  // The shared pool, so auth writes join application transactions and the
  // process keeps one connection pool rather than two.
  database: options.pool,
  baseURL: options.baseURL,
  secret: options.secret,
  trustedOrigins: [...options.trustedOrigins],

  /**
   * Sharing the session cookie across subdomains of one parent.
   *
   * The browser decides this, not better-auth: a cookie can only be scoped to a
   * domain the setter is under, and never to a public suffix. `app.example.com`
   * and `api.example.com` can share `.example.com`; two Railway-generated hosts
   * cannot share `.up.railway.app`, because that name is on the Public Suffix
   * List. A deployment that splits the two therefore needs its own domain.
   */
  ...(options.cookieDomain === undefined ? {} : {
    advanced: {
      crossSubDomainCookies: { enabled: true, domain: options.cookieDomain },
    },
  }),

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }: { user: { email: string; }; url: string; }) => {
      await send(options, user.email, ResetPassword, { url, product: options.product });
    },
  },

  emailVerification: {
    // Sent as part of signing up rather than waiting for the user to ask.
    sendOnSignUp: true,
    // The verification link lands them signed in, so there is no second step.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }: { user: { email: string; }; url: string; }) => {
      await send(options, user.email, VerifyEmail, { url, product: options.product });
    },
  },

  socialProviders: options.google === undefined ? {} : { google: options.google },

  databaseHooks: {
    user: {
      create: {
        // Every user gets a personal organization immediately, so there is no
        // orgless state for the rest of the system to represent or handle.
        after: async (user: { id: string; name: string; email: string; }) => {
          const organizationId = randomUUID();
          const handle = user.email.split("@")[0] ?? "user";

          await options.pool.query(
            `insert into "organization" ("id", "name", "slug", "createdAt") values ($1, $2, $3, now())`,
            [
              organizationId,
              `${user.name === "" ? handle : user.name}'s Organization`,
              `${handle}-${user.id.slice(-6)}`.toLowerCase(),
            ],
          );

          await options.pool.query(
            `insert into "member" ("id", "organizationId", "userId", "role", "createdAt") values ($1, $2, $3, 'owner', now())`,
            [randomUUID(), organizationId, user.id],
          );
        },
      },
    },
  },

  plugins: [
    organization({
      ac: accessControl,
      roles,
      // Custom per-organization roles, stored in `organizationRole` and merged
      // over the static roles above when better-auth checks a permission.
      dynamicAccessControl: { enabled: true },
      /**
       * The seat limit, asked per invitation rather than read once, so an
       * upgrade takes effect on the next invite rather than the next deploy.
       *
       * Enforced here rather than in a policy because better-auth owns the
       * invitation endpoints — a check on our side would be one an invitation
       * created through its own API walks straight past.
       */
      membershipLimit: (_user, organization) => options.seatsFor(organization.id),
      sendInvitationEmail: async (data) => {
        await send(options, data.email, Invitation, {
          // The web app resolves this, not the API: the link is something a
          // person clicks, and what they need is a page.
          url: `${options.webUrl}/auth/accept-invitation/${data.id}`,
          organization: data.organization.name,
          role: data.role,
          product: options.product,
        });
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await send(options, email, MagicLink, { url, product: options.product });
      },
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp }) => {
        await send(options, email, EmailOtp, { code: otp, product: options.product });
      },
    }),
    /**
     * What a phone needs, and a browser does not.
     *
     * A browser keeps the session in a cookie the platform manages. React
     * Native has no such jar to rely on, so the Expo client sends a bearer
     * token instead — and this plugin is the half of that arrangement that
     * accepts it. Without it a signed-in phone arrives anonymous at every
     * request, which looks exactly like a broken session.
     *
     * It is harmless to a deployment with no mobile app: it adds a way to
     * authenticate, not a way around authenticating.
     */
    expo(),

    /**
     * Single sign-on, OIDC and SAML 2.0, configured per organization.
     *
     * Which is the shape B2B actually needs: one tenant is on Okta, the next on
     * Entra, and both arrive at the same deployment. A provider carries the
     * organization that owns it and the email domain that routes to it, so
     * `/sign-in/sso` can take an address and find the right identity provider
     * without the person choosing from a list of other people's employers.
     */
    sso({
      /**
       * A provider does not work until its domain is proved by DNS.
       *
       * This is the whole security story and it is not optional. Without it,
       * anybody who can register a provider can claim `acme.com` and become
       * the identity provider for everyone whose address ends that way —
       * account takeover with a settings form in front of it. better-auth's own
       * documentation says as much where it deprecates `trustEmailVerified`,
       * which is left off here for the same reason.
       */
      domainVerification: { enabled: true },

      /**
       * Somebody arriving through an organization's provider joins that
       * organization as a member.
       *
       * `member` rather than `admin` because the provider says who somebody is,
       * not what they may do. An identity provider that could mint admins would
       * make the organization's permission model a property of somebody else's
       * directory.
       */
      organizationProvisioning: { defaultRole: "member" },
    }),
  ],

  /**
   * The entitlement check better-auth cannot make for itself.
   *
   * It already refuses a registration from somebody who is not an owner or
   * admin of the organization — that is `hasOrgAdminRole` inside the plugin,
   * and `Permission.ts` matches it deliberately rather than duplicating it.
   * What it cannot know is whether the organization is *paying* for SSO, which
   * is an `Entitlement` and lives in a table it has never heard of.
   *
   * A `before` hook rather than a check in our own handler, because this
   * endpoint is better-auth's: a check anywhere else is one a request straight
   * to `/api/auth/sso/register` walks past. The seat limit taught that lesson
   * from the other direction.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sso/register") return;

      const organizationId = (ctx.body as { organizationId?: unknown; } | undefined)
        ?.organizationId;

      /**
       * A provider with no organization is a personal one, which no plan gates.
       * The organization case is the one that costs money.
       */
      if (typeof organizationId !== "string" || organizationId === "") return;

      if (!await options.ssoEntitled(organizationId)) {
        throw new APIError("FORBIDDEN", {
          message: "This organization's plan does not include single sign-on.",
        });
      }
    }),
  },
});

export const makeAuth = (options: MakeAuthOptions): AuthInstance => {
  const auth = betterAuth(authOptions(options));

  return {
    handler: (request) => auth.handler(request),

    // Effect models headers as a string record; better-auth wants web Headers.
    getSession: async (headers) => {
      const session = await auth.api.getSession({ headers: new Headers(headers) });
      if (session === null) return null;

      // The organization plugin adds `activeOrganizationId` to the session row
      // at runtime but not to better-auth's types, so it is read back with SQL
      // rather than through an unsafe cast. Honouring it is what makes
      // switching organizations take effect.
      const { rows } = await options.pool.query<
        { organizationId: string; role: string; id: string; }
      >(
        `select m."organizationId", m."role", m."id"
         from "member" m
         where m."userId" = $1
           and m."organizationId" = coalesce(
             (select s."activeOrganizationId" from "session" s where s."id" = $2),
             m."organizationId"
           )
         order by m."createdAt" asc
         limit 1`,
        [session.user.id, session.session.id],
      );

      return {
        user: session.user,
        session: {
          id: session.session.id,
          activeOrganizationId: rows[0]?.organizationId ?? null,
          role: rows[0]?.role ?? null,
          memberId: rows[0]?.id ?? null,
        },
      };
    },
  };
};

/**
 * Emits the DDL better-auth needs for this exact plugin set, so the committed
 * migration is generated rather than guessed.
 */
export const compileAuthMigrations = async (options: MakeAuthOptions): Promise<string> => {
  const { compileMigrations } = await getMigrations(authOptions(options));

  return compileMigrations();
};
