import { expo } from "@better-auth/expo";
import { scim } from "@better-auth/scim";
import { sso } from "@better-auth/sso";
import { renderEmail } from "@vantion/emails/Render";
import { EmailOtp } from "@vantion/emails/templates/EmailOtp";
import { Invitation } from "@vantion/emails/templates/Invitation";
import { MagicLink } from "@vantion/emails/templates/MagicLink";
import { ResetPassword } from "@vantion/emails/templates/ResetPassword";
import { VerifyEmail } from "@vantion/emails/templates/VerifyEmail";
import type { EmailMessage } from "@vantion/module-notifications/Mailer";
import type { Session, User } from "better-auth";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { admin, emailOTP, magicLink, organization, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import type * as Pg from "pg";
import { grantsFor, statements } from "../identity/Permission.js";
import { authenticatedScimOrganization } from "./ScimSeats.js";

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
  /**
   * Whether the organization's plan carries directory provisioning, asked
   * before a SCIM token may be issued. Separate from `ssoEntitled` because the
   * two are separate features on the plan even though they are bought together.
   */
  readonly scimEntitled: (organizationId: string) => Promise<boolean>;
  /**
   * Whether one more member would fit inside the plan's seats.
   *
   * A single question rather than a limit and a count, because the caller that
   * asks it has neither: an identity provider pushing users arrives with a
   * token and an organization and nothing else. **This is the gap it closes.**
   * `membershipLimit` guards better-auth's *invitation* endpoints, and SCIM
   * provisioning does not go through them — it inserts a `member` row through
   * the adapter directly, so a directory of five hundred people would fill an
   * organization sold three seats and nothing would have said no.
   */
  readonly seatAvailableFor: (organizationId: string) => Promise<boolean>;
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

/**
 * What `getSession` returns, which is not better-auth's session.
 *
 * The **user** half is better-auth's and is taken from it rather than retyped,
 * so a field that changes type upstream is a compiler error here.
 *
 * The **session** half is ours. Only `id` comes from better-auth; the other
 * three do not exist in its `Session` type at all. `activeOrganizationId` is
 * written to the session row by the organization plugin at runtime and left out
 * of its types, and `role` and `memberId` are the result of the `member` join in
 * `getSession` below. So this is the shape of our own query, not a second
 * declaration of somebody else's.
 *
 * What is _not_ available is better-auth's own inferred session,
 * `typeof auth.$Infer.Session`. With this plugin set it fails to cross a
 * `declaration: true` boundary — **TS2883**, "cannot be named without a
 * reference to `$strip` from `.bun/zod@4.6.5/.../zod/v4/core`": the inferred
 * type reaches into zod's internals, and their path inside the package store is not
 * nameable from an emitted `.d.ts`. Its non-inferred `User` and `Session`
 * exports have no such problem, which is why the user half can be derived and
 * `authOptions` still stays unexported.
 */
export interface AuthSession {
  readonly user: Pick<User, "id" | "email" | "emailVerified">;
  readonly session: {
    readonly id: Session["id"];
    readonly activeOrganizationId?: string | null | undefined;
    readonly role?: string | null | undefined;
    readonly memberId?: string | null | undefined;
  };
}

/** The only surface the rest of the server sees. */
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
  // `PgPool`, not a pool of its own: better-auth needs a `pg.Pool`, and taking
  // the process's one means it connects wherever `DATABASE_URL` says. Its
  // writes never joined an Effect transaction — a transaction reserves a
  // connection this pool cannot see — and since `@effect/sql-pg` stopped
  // wrapping `pg`, the two do not even share connections.
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
        /**
         * The seat limit, on the one path that would otherwise walk past it.
         *
         * `membershipLimit` guards better-auth's *invitation* endpoints, and
         * SCIM provisioning does not go through them — it inserts a `member`
         * row through the adapter directly. Without this, a directory of five
         * hundred people fills an organization sold three seats and nothing
         * says no: revenue, and the easiest way to grow this database from
         * outside.
         *
         * Here rather than in a `before` hook on the route, because a route
         * hook runs **ahead of the plugin's own middleware** — the first
         * version did, and it answered a forged token with "no seats left"
         * instead of "unauthorized". This runs inside the handler, after the
         * token has been verified, and `authenticatedScimOrganization` reads
         * what the plugin resolved rather than what the caller sent.
         *
         * Blocking the *user* is sufficient because `linkExistingUsers` is
         * off: a SCIM request that would add somebody to an organization is
         * always one that creates them, and a matching address is refused as a
         * conflict instead.
         */
        before: async (_user: unknown, context: GenericEndpointContext | null) => {
          const organizationId = authenticatedScimOrganization(context);

          // Not a SCIM request. Ordinary sign-up is not seat-limited: the
          // personal organization every account gets has one member, itself.
          if (organizationId === undefined) return;

          if (!await options.seatAvailableFor(organizationId)) {
            throw new APIError("FORBIDDEN", {
              message: "This organization has no seats left on its plan.",
            });
          }
        },
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
     * Staff, which is a different thing from an organization's owner.
     *
     * This adds `role` to `user` — a *system* role, unrelated to `member.role`,
     * which is somebody's standing inside one organization. `adminRoles`
     * defaults to `["admin"]` and every existing user is a plain `user`, so
     * switching this on grants nobody anything.
     *
     * Its endpoints are mounted on this instance, which is the customer-facing
     * API, and that is a deliberate decision rather than an oversight. The
     * alternative is a second better-auth instance in the admin application,
     * and two instances over one `user` table is the arrangement where the two
     * quietly disagree about who somebody is. They are gated by better-auth's
     * own `adminRoles` check, which is the same check we would otherwise write.
     *
     * What makes that safe is the layer underneath. A session that somehow
     * became `role: "admin"` on this process gains better-auth's user
     * management and **no tenant data at all**, because `apps/server` connects
     * as `vantion` and cannot bypass a row-level security policy whatever it is
     * asked to do. Reading across organizations needs `ADMIN_DATABASE_URL`,
     * which this process does not have. The two controls compose rather than
     * overlapping: one decides who you are, the other decides what the
     * connection can see.
     */
    admin(),

    /**
     * A second factor, available to everybody and **required of staff**.
     *
     * Offered to customers because an organization's owner can delete the
     * organization, and required of staff because `apps/admin` reads across
     * every tenant — a surface whose whole protection is "somebody proved they
     * are staff" is a surface only as strong as one person's password.
     * `StaffResolver` is where that requirement lives; this plugin is what
     * makes it possible to satisfy.
     *
     * TOTP, which needs nothing from us. The OTP-over-email variant is left
     * off: a second factor delivered to the address that recovers the first is
     * a second lock with the same key, and on the OTP sign-in path this
     * deployment already has, it would be the *same* channel twice.
     */
    twoFactor({ issuer: options.product }),

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

    /**
     * Directory provisioning: an identity provider pushing users in, and
     * switching them off when somebody leaves.
     *
     * SCIM 2.0 is a specification with a body of expected behaviour — filters,
     * `PATCH` operations, `ListResponse` envelopes, its own error shape — and
     * this is `@better-auth/scim` rather than a hand-written router for the
     * same reason `/sso/register` is the plugin's endpoint: reimplementing
     * somebody else's protocol beside the library that already speaks it is
     * how the two come to disagree.
     *
     * Three of its defaults are changed, and every one of them is a security
     * decision rather than a preference.
     */
    scim({
      /**
       * **The default is `plain`.** That would put a credential able to create
       * and disable users across an organization into the database in readable
       * form — the same mistake `apiKey` avoids by storing only a hash, and
       * worse, because this one is long-lived and belongs to a machine that
       * never notices it has leaked.
       *
       * The cost is honest and small: a token cannot be shown again, so
       * "rotate" is delete-and-generate. The screen says so.
       */
      storeSCIMToken: "hashed",

      /**
       * **Personal tokens are refused outright.**
       *
       * The plugin's own documentation says non-organization token creation is
       * "otherwise available to any authenticated user", and a SCIM token can
       * provision and manage users. In a B2B product there is no such thing as
       * a personal directory, so the answer is not a narrower rule — it is that
       * this shape does not exist here.
       *
       * Runs after the built-in checks, so it can only tighten them.
       */
      canGenerateToken: ({ organizationId }) =>
        typeof organizationId === "string" && organizationId !== "",

      /**
       * **Left off, which is the plugin's default and the right one.**
       *
       * Enabling it would let a SCIM token claim an existing account whose
       * email happens to match — an account it never provisioned, possibly in
       * another organization entirely. A directory that pushes
       * `ada@example.com` would be handed whoever already signed up with that
       * address. Named here rather than omitted, because a future reader
       * looking for the switch should find the reason beside it.
       */
      linkExistingUsers: false,
      /**
       * Widened to the plugin interface, and only because of
       * `exactOptionalPropertyTypes`.
       *
       * The plugin builds its table declaration by spreading a conditional —
       * `...providerOwnership ? { userId: … } : {}` — which TypeScript widens
       * to `userId?: … | undefined`, and better-auth's own schema type does not
       * accept an explicitly-undefined field under that flag. Nothing here is
       * being hidden: the SCIM endpoints are called by an identity provider
       * over HTTP and by `authClient.scim.*` on the client, neither of which
       * reads this inference, so what is lost is a shape nothing consumes.
       */
    }) as BetterAuthPlugin,
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
      if (ctx.path === "/scim/generate-token") {
        const organizationId = (ctx.body as { organizationId?: unknown; } | undefined)
          ?.organizationId;

        // `canGenerateToken` already refuses a personal token; this is the
        // plan question, which the plugin cannot answer for itself.
        if (typeof organizationId !== "string" || organizationId === "") return;

        if (!await options.scimEntitled(organizationId)) {
          throw new APIError("FORBIDDEN", {
            message: "This organization's plan does not include directory provisioning.",
          });
        }

        return;
      }

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
