import { authClient } from "@/iam/auth-client.js";
import { Keys } from "@vantion/core/Keys";
import { Data, Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

/**
 * Directory provisioning goes through the auth client, not through RPC.
 *
 * The same argument `/settings/sso` makes: these are better-auth's endpoints,
 * they already check organization membership and role, and `/scim/generate-token`
 * already refuses a caller who is not an admin. A procedure of ours in front
 * would be a second implementation of all of that, free to disagree with the
 * one that actually runs.
 */

export class ScimFailed extends Data.TaggedError("ScimFailed")<{
  readonly reason: "NotEntitled" | "Rejected";
  readonly message: string;
}> {}

interface AuthError {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
}

const orFail = <A>(result: {
  readonly data: A | null;
  readonly error: AuthError | null;
}): Effect.Effect<A, ScimFailed> =>
  result.error === null ? Effect.succeed(result.data as A) : Effect.fail(
    new ScimFailed({
      reason: result.error.message?.includes("directory provisioning") === true
        ? "NotEntitled"
        : "Rejected",
      message: result.error.message ?? "That was refused.",
    }),
  );

/**
 * A connection as the screen shows it — three fields, never the token.
 *
 * Narrowed for the reason the SSO panel narrows its own row: hydration needs a
 * schema, and a schema for the library's whole shape would be a copy that
 * drifts. The token is not among them because the endpoint does not return it:
 * it is stored hashed and shown once, at the moment it is issued.
 */
const ConnectionRow = Schema.Struct({
  id: Schema.String,
  providerId: Schema.String,
  organizationId: Schema.NullOr(Schema.String),
});

export type ScimConnectionRow = typeof ConnectionRow.Type;

export const scimSerial = {
  key: "scimConnections",
  schema: AsyncResult.Schema({ success: Schema.Array(ConnectionRow) }),
};

export const scimConnectionsAtom = Atom.withReactivity([Keys.organization, Keys.scim])(
  Atom.make(
    Effect.promise(() => authClient.scim.listProviderConnections()).pipe(
      Effect.flatMap(orFail<{ providers: ReadonlyArray<Record<string, unknown>>; }>),
      Effect.map((data): ReadonlyArray<ScimConnectionRow> =>
        data.providers.map((provider) => ({
          id: String(provider["id"]),
          providerId: String(provider["providerId"]),
          organizationId: typeof provider["organizationId"] === "string"
            ? provider["organizationId"]
            : null,
        }))
      ),
    ),
  ),
).pipe(Atom.serializable(scimSerial));

/**
 * The token is returned **once**, here, and never again.
 *
 * `storeSCIMToken: "hashed"` is what makes that true, and it is the right
 * trade: the alternative is a credential able to create and disable users
 * across an organization sitting readable in the database. "Rotate" is
 * therefore delete-and-generate, which the screen says.
 */
export const generateScimTokenAtom = Atom.fn<
  { readonly organizationId: string; readonly providerId: string; }
>()(
  (input) =>
    Effect.promise(() => authClient.scim.generateToken(input)).pipe(
      Effect.flatMap(orFail<{ scimToken: string; }>),
    ),
);

export const deleteScimConnectionAtom = Atom.fn<string>()(
  (providerId) =>
    Effect.promise(() => authClient.scim.deleteProviderConnection({ providerId })).pipe(
      Effect.flatMap(orFail<unknown>),
    ),
);
