import { PgPool } from "@vantion/database/PgPool";
import type { EmailMessage } from "@vantion/module-notifications/Mailer";
import { Mailer } from "@vantion/module-notifications/Mailer";
import { Config, Context, Effect, Layer, Option, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { has } from "../identity/Entitlement.js";
import { EntitlementResolver } from "../identity/EntitlementResolver.js";
import { seatsUsedFor } from "../identity/Usage.js";
import type { AuthInstance } from "./Options.js";
import { makeAuth } from "./Options.js";

/**
 * better-auth, behind the only seam in the codebase that leaves the Effect
 * runtime.
 *
 * better-auth invokes its `sendX` callbacks from its own promise chain, so an
 * Effect has to be run to completion inside them. Because `Mailer` is resolved
 * to a value here, `mailer.send` carries no remaining requirements and a bare
 * `Effect.runPromise` suffices — there is no context to thread through. A
 * rejected promise surfaces to the caller as a better-auth error, which is the
 * behaviour we want when mail cannot be sent.
 */
export class Auth extends Context.Service<Auth, AuthInstance>()("Auth") {
  static layer: Layer.Layer<
    Auth,
    never,
    PgPool | Mailer | EntitlementResolver | SqlClient.SqlClient
  > = Layer
    .effect(Auth)(
      Effect.gen(function*() {
        const pool = yield* PgPool;
        const mailer = yield* Mailer;
        const entitlements = yield* EntitlementResolver;
        /**
         * Resolved to a value here so the callbacks below can run a query from
         * better-auth's own promise chain, where there is no context to thread
         * through — the same reason `mailer` is taken here rather than inside
         * `sendEmail`.
         */
        const sql = yield* SqlClient.SqlClient;

        const baseURL = yield* Config.NonEmptyString("AUTH_BASE_URL").pipe(
          Config.withDefault("http://localhost:3000"),
        );
        const secret = yield* Config.Redacted("AUTH_SECRET");
        const webUrl = yield* Config.NonEmptyString("WEB_URL").pipe(
          Config.withDefault("http://localhost:5173"),
        );

        /**
         * What the transactional emails call this product.
         *
         * Configured rather than hard-coded: the subject line of a sign-in mail is the
         * first thing a customer of a renamed fork ever reads.
         */
        const product = yield* Config.NonEmptyString("PRODUCT_NAME").pipe(
          Config.withDefault("vantion"),
        );

        /**
         * Set only when the web app and the API are on different subdomains of one
         * parent — `.example.com`. Left unset they share a host and better-auth's
         * default is correct.
         */
        const cookieDomain = yield* Config.option(Config.NonEmptyString("AUTH_COOKIE_DOMAIN"));

        /**
         * Identity-provider origins an OIDC registration may fetch discovery
         * from, comma-separated.
         *
         * better-auth checks a discovery URL against `trustedOrigins` before
         * fetching it, which is right — the URL comes from whoever is
         * registering the provider, and fetching an arbitrary one server-side
         * is a request-forgery primitive aimed at the inside of your network.
         *
         * The consequence is that discovery cannot be self-serve: trusting a
         * customer's IdP is an operator's decision and a restart. The settings
         * screen therefore registers providers with explicit endpoints and
         * `skipDiscovery`, which needs only a publicly routable host — so this
         * variable is for the deployments that prefer discovery, and is empty
         * by default.
         */
        const discoveryOrigins = yield* Config.NonEmptyString("SSO_DISCOVERY_ORIGINS").pipe(
          Config.withDefault(""),
        );

        const google = yield* Config.all({
          clientId: Config.NonEmptyString("GOOGLE_CLIENT_ID"),
          clientSecret: Config.NonEmptyString("GOOGLE_CLIENT_SECRET"),
        }).pipe(Config.option);

        const sendEmail = (message: EmailMessage): Promise<void> =>
          Effect.runPromise(mailer.send(message));

        return makeAuth({
          pool,
          product,
          webUrl,
          /**
           * Resolved per invitation rather than captured once, so an upgrade
           * raises the limit on the next invite instead of the next deploy.
           *
           * `runPromise` because better-auth asks from its own promise chain, and
           * the resolver is already a value here with nothing left to provide.
           */
          seatsFor: (organizationId) =>
            Effect.runPromise(
              Effect.map(entitlements.resolve({ organizationId }), (e) => e.limits.seats),
            ),
          /**
           * Asked per registration, for the same reason the seat limit is asked
           * per invitation: an upgrade should take effect on the next request
           * rather than the next deploy.
           */
          ssoEntitled: (organizationId) =>
            Effect.runPromise(
              Effect.map(entitlements.resolve({ organizationId }), (e) =>
                has(e.effectivePlan, "sso")),
            ),
          scimEntitled: (organizationId) =>
            Effect.runPromise(
              Effect.map(entitlements.resolve({ organizationId }), (e) =>
                has(e.effectivePlan, "scim")),
            ),
          /**
           * The limit and the count together, because the caller that asks has
           * neither — an identity provider arrives with a token and an
           * organization. Both are read per request, so an upgrade lets the
           * next push through rather than the next deploy.
           */
          seatAvailableFor: (organizationId) =>
            Effect.runPromise(
              Effect.map(
                Effect.all([
                  entitlements.resolve({ organizationId }),
                  seatsUsedFor(organizationId),
                ]),
                ([entitlement, used]) => used < entitlement.limits.seats,
              ).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
            ),
          baseURL,
          secret: Redacted.value(secret),
          /**
           * The web origin, and the mobile app's scheme.
           *
           * `vantion://` is not an origin a browser would ever send, and
           * better-auth refuses anything unlisted — so a deep link back from a
           * magic link or an OAuth redirect fails without it. It matches
           * `scheme` in `apps/mobile/app.json`; change one and change both.
           */
          trustedOrigins: [
            webUrl,
            "vantion://",
            ...discoveryOrigins.split(",").map((origin) => origin.trim()).filter((origin) =>
              origin !== ""
            ),
          ],
          cookieDomain: Option.getOrUndefined(cookieDomain),
          google: Option.getOrUndefined(google),
          sendEmail,
        });
      }),
    ).pipe(Layer.orDie);
}
