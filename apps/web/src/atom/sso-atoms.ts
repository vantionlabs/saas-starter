import { authClient } from "@/iam/auth-client.js";
import { Keys } from "@vantion/core/Keys";
import { Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

/**
 * Single sign-on goes through the auth client, not through RPC.
 *
 * `/sso/providers` already returns only the organizations the caller
 * administers and already strips the client secret, and `/sso/register` already
 * validates the endpoints and refuses a non-member. An RPC in front of either
 * would be a second implementation of both, free to disagree with the one that
 * actually runs. Reads and writes here are the same transport as sign-in for
 * the same reason it is: better-auth owns the session and owns these rows.
 */

/** What a screen can act on. Anything else stays a defect. */
export class SsoFailed extends Schema.TaggedError<SsoFailed>()("SsoFailed", {
  reason: Schema.Literals(["NotEntitled", "Forbidden", "Rejected"]),
  message: Schema.String,
}) {}

/**
 * `| undefined` on every field, not just `?`.
 *
 * `exactOptionalPropertyTypes` is on, so an optional property does not accept an
 * explicit `undefined` — and better-auth's error body is declared with exactly
 * that. Written the shorter way this does not match what the client returns.
 */
interface AuthError {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
}

const failureOf = (error: AuthError) =>
  Effect.fail(
    new SsoFailed({
      reason: error.message?.includes("does not include single sign-on") === true
        ? "NotEntitled"
        : error.status === 403
        ? "Forbidden"
        : "Rejected",
      message: error.message ?? "That was refused.",
    }),
  );

/**
 * better-auth's client resolves with `{ error }` rather than rejecting, so a
 * refusal is a value to inspect and not something to catch.
 */
const orFail = <A>(result: {
  readonly data: A | null;
  readonly error: AuthError | null;
}): Effect.Effect<A, SsoFailed> =>
  result.error === null ? Effect.succeed(result.data as A) : failureOf(result.error);

/**
 * Taken from the client rather than retyped.
 *
 * It already carries `domainVerified`, `spMetadataUrl` and an `oidcConfig` with
 * the secret replaced by its last four characters — a shape worth having in
 * full, and one that would drift the moment it was copied. `apps/web` emits no
 * declarations, so better-auth's inferred types are nameable here in a way they
 * are not inside a package that does.
 */
export type SsoProvider = NonNullable<
  Awaited<ReturnType<typeof authClient.sso.providers>>["data"]
>["providers"][number];

/**
 * Every provider the caller administers, across organizations.
 *
 * The screen narrows to the active one. Subscribing to `Keys.organization` is
 * what makes switching organization re-read it rather than leaving the previous
 * tenant's providers on screen.
 */
export const ssoProvidersAtom = Atom.withReactivity([Keys.organization])(
  Atom.make(
    Effect.promise(() => authClient.sso.providers()).pipe(
      Effect.flatMap(orFail),
      Effect.map((data): ReadonlyArray<SsoProvider> => data.providers),
    ),
  ),
);

export interface RegisterProvider {
  readonly organizationId: string;
  readonly providerId: string;
  readonly issuer: string;
  readonly domain: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksEndpoint: string;
}

/**
 * `skipDiscovery`, always.
 *
 * The alternative is to give an issuer and let the server fetch its
 * `.well-known` document — but that URL comes from whoever is filling in this
 * form, and better-auth therefore requires its origin to be among the trusted
 * ones before fetching it. Correctly: fetching an arbitrary URL from inside the
 * network is a request-forgery primitive. The consequence is that discovery
 * cannot be self-serve, and a settings form that needed a deploy to work is not
 * a settings form. Explicit endpoints are three more fields and no fetch.
 */
export const registerProviderAtom = Atom.fn<RegisterProvider>()(
  (input) =>
    Effect.promise(() =>
      authClient.sso.register({
        providerId: input.providerId,
        issuer: input.issuer,
        domain: input.domain,
        organizationId: input.organizationId,
        oidcConfig: {
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          skipDiscovery: true,
          authorizationEndpoint: input.authorizationEndpoint,
          tokenEndpoint: input.tokenEndpoint,
          jwksEndpoint: input.jwksEndpoint,
          scopes: ["openid", "email", "profile"],
        },
      })
    ).pipe(Effect.flatMap(orFail)),
);

export const removeProviderAtom = Atom.fn<string>()(
  (providerId) =>
    Effect.promise(() => authClient.sso.deleteProvider({ providerId })).pipe(
      Effect.flatMap(orFail),
    ),
);

/**
 * Sign in by email address, not by picking an employer from a list.
 *
 * The address is the routing key: its domain finds the organization's provider,
 * and the browser leaves for the identity provider from there. Offering a list
 * instead would show every customer who the other customers are.
 */
export const signInWithSso = (email: string) =>
  Effect.promise(() =>
    authClient.signIn.sso({
      email,
      callbackURL: `${window.location.origin}/`,
      errorCallbackURL: `${window.location.origin}/auth/sign-in?sso=failed`,
    })
  ).pipe(Effect.flatMap(orFail));

/**
 * Asks better-auth to look the record up now.
 *
 * It resolves rather than fails when the record is absent — "not there yet" is
 * the ordinary answer while DNS propagates, not an error somebody should be
 * shown in red.
 */
export const verifyDomainAtom = Atom.fn<string>()(
  (providerId) =>
    Effect.promise(() => authClient.sso.verifyDomain({ providerId })).pipe(
      Effect.map((result) => ({ verified: result.error === null && result.data !== null })),
    ),
);
