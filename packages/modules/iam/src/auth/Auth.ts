import { PgPool } from "@vantion/database/PgPool";
import type { EmailMessage } from "@vantion/module-notifications/Mailer";
import { Mailer } from "@vantion/module-notifications/Mailer";
import { Config, Context, Effect, Layer, Option, Redacted } from "effect";
import { EntitlementResolver } from "../identity/EntitlementResolver.js";
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
  static layer: Layer.Layer<Auth, never, PgPool | Mailer | EntitlementResolver> = Layer
    .effect(Auth)(
      Effect.gen(function*() {
        const pool = yield* PgPool;
        const mailer = yield* Mailer;
        const entitlements = yield* EntitlementResolver;

        const baseURL = yield* Config.nonEmptyString("AUTH_BASE_URL").pipe(
          Config.withDefault("http://localhost:3000"),
        );
        const secret = yield* Config.redacted("AUTH_SECRET");
        const webUrl = yield* Config.nonEmptyString("WEB_URL").pipe(
          Config.withDefault("http://localhost:5173"),
        );

        /**
         * What the transactional emails call this product.
         *
         * Configured rather than hard-coded: the subject line of a sign-in mail is the
         * first thing a customer of a renamed fork ever reads.
         */
        const product = yield* Config.nonEmptyString("PRODUCT_NAME").pipe(
          Config.withDefault("vantion"),
        );

        /**
         * Set only when the web app and the API are on different subdomains of one
         * parent — `.example.com`. Left unset they share a host and better-auth's
         * default is correct.
         */
        const cookieDomain = yield* Config.option(Config.nonEmptyString("AUTH_COOKIE_DOMAIN"));

        const google = yield* Config.all({
          clientId: Config.nonEmptyString("GOOGLE_CLIENT_ID"),
          clientSecret: Config.nonEmptyString("GOOGLE_CLIENT_SECRET"),
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
          baseURL,
          secret: Redacted.value(secret),
          trustedOrigins: [webUrl],
          cookieDomain: Option.getOrUndefined(cookieDomain),
          google: Option.getOrUndefined(google),
          sendEmail,
        });
      }),
    ).pipe(Layer.orDie);
}
