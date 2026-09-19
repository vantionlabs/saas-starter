import { authClient } from "@/iam/auth-client.js";
import { Data, Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

/**
 * The person, not the organization.
 *
 * Everything here goes through better-auth's own client rather than an RPC of
 * ours, for the reason `/settings/sso` does: these are its endpoints, it
 * already validates them, and a procedure in front would be a second
 * implementation free to disagree with the one that runs.
 */

export class AccountFailed extends Data.TaggedError("AccountFailed")<{
  readonly message: string;
}> {}

const orFail = <A>(result: {
  readonly data: unknown;
  readonly error: { readonly message?: string | undefined; } | null;
}): Effect.Effect<A, AccountFailed> =>
  result.error === null
    ? Effect.succeed(result.data as A)
    : Effect.fail(new AccountFailed({ message: result.error.message ?? "That did not work." }));

/**
 * One signed-in session, as the screen shows it.
 *
 * Narrowed to five fields rather than carrying better-auth's whole session
 * row: hydration needs a schema, and the full shape includes the **token** —
 * which is the credential itself and has no business in a page's serialized
 * state, let alone in the HTML.
 */
const SessionRow = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  expiresAt: Schema.String,
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
});

export type AccountSession = typeof SessionRow.Type;

export const sessionsSerial = {
  key: "accountSessions",
  schema: AsyncResult.Schema({ success: Schema.Array(SessionRow) }),
};

export const sessionsAtom = Atom.make(
  Effect.promise(() => authClient.listSessions()).pipe(
    Effect.flatMap(orFail<ReadonlyArray<Record<string, unknown>>>),
    Effect.map((rows): ReadonlyArray<AccountSession> =>
      rows.map((row) => ({
        id: String(row["id"]),
        createdAt: String(row["createdAt"]),
        expiresAt: String(row["expiresAt"]),
        ipAddress: typeof row["ipAddress"] === "string" ? row["ipAddress"] : null,
        userAgent: typeof row["userAgent"] === "string" ? row["userAgent"] : null,
      }))
    ),
  ),
).pipe(Atom.serializable(sessionsSerial));

/** Renames the account. `updateUser` is better-auth's own, and needs no password. */
export const renameAccount = (name: string) =>
  Effect.promise(() => authClient.updateUser({ name })).pipe(Effect.flatMap(orFail<unknown>));

/**
 * Changing a password asks for the current one, which better-auth requires and
 * is right to: a session somebody else has stolen must not be able to lock the
 * owner out by choosing a new password.
 *
 * `revokeOtherSessions` is on, because the usual reason to change a password is
 * that it may be known — leaving every other session signed in would undo the
 * point of changing it.
 */
export const changePassword = (input: {
  readonly currentPassword: string;
  readonly newPassword: string;
}) =>
  Effect.promise(() => authClient.changePassword({ ...input, revokeOtherSessions: true })).pipe(
    Effect.flatMap(orFail<unknown>),
  );

/** Ends every other session but this one. */
export const signOutEverywhereElse = Effect.promise(() => authClient.revokeOtherSessions()).pipe(
  Effect.flatMap(orFail<unknown>),
);
