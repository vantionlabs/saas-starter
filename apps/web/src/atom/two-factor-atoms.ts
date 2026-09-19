import { authClient } from "@/iam/auth-client.js";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

/**
 * Enrolment, through the auth client for the same reason single sign-on goes
 * that way: better-auth owns these endpoints, the session and the `twoFactor`
 * rows, and an RPC in front would be a second implementation of all three.
 */

export class TwoFactorFailed extends Schema.TaggedError<TwoFactorFailed>()("TwoFactorFailed", {
  reason: Schema.Literals(["WrongPassword", "WrongCode", "Rejected"]),
  message: Schema.String,
}) {}

interface AuthError {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
}

/**
 * A wrong password and a wrong code both come back as 401, and they are told
 * apart by which call was made rather than by the response — the endpoints do
 * not distinguish them and should not.
 */
const orFail = <A>(
  reason: TwoFactorFailed["reason"],
  fallback: string,
) =>
(result: { readonly data: A | null; readonly error: AuthError | null; }) =>
  result.error === null
    ? Effect.succeed(result.data as A)
    : Effect.fail(
      new TwoFactorFailed({ reason, message: result.error.message ?? fallback }),
    );

/**
 * Turns it on and hands back the secret and the codes, both exactly once.
 *
 * The password is asked for again here on purpose: enabling a second factor
 * from a session somebody else has stolen would be a way to lock the owner out
 * of their own account rather than a way to protect it.
 */
export const enableTwoFactor = (password: string) =>
  Effect.promise(() => authClient.twoFactor.enable({ password })).pipe(
    Effect.flatMap(orFail("WrongPassword", "That password was not accepted.")),
  );

/** Confirms the app is generating the right codes before anything depends on it. */
export const verifyTotp = (code: string) =>
  Effect.promise(() => authClient.twoFactor.verifyTotp({ code })).pipe(
    Effect.flatMap(orFail("WrongCode", "That code was not accepted.")),
  );

export const disableTwoFactor = (password: string) =>
  Effect.promise(() => authClient.twoFactor.disable({ password })).pipe(
    Effect.flatMap(orFail("WrongPassword", "That password was not accepted.")),
  );

/** Completes a sign-in that stopped to ask for the second factor. */
export const signInWithTotp = (code: string) =>
  Effect.promise(() => authClient.twoFactor.verifyTotp({ code })).pipe(
    Effect.flatMap(orFail("WrongCode", "That code was not accepted.")),
  );

/** The other way in when the phone is gone. Each code works once. */
export const signInWithBackupCode = (code: string) =>
  Effect.promise(() => authClient.twoFactor.verifyBackupCode({ code })).pipe(
    Effect.flatMap(orFail("WrongCode", "That backup code was not accepted.")),
  );

/**
 * Whether it is on, and whether this account has no choice.
 *
 * Read from better-auth's own session rather than from `Me`: `twoFactorEnabled`
 * and the system `role` are fields its plugins own and write, and copying them
 * into our `Identity` would be two places for one fact.
 */
/**
 * Server-rendered, so the security screen does not flash a skeleton over two
 * booleans the session already knows.
 */
export const twoFactorSerial = {
  key: "twoFactor",
  schema: AsyncResult.Schema({
    success: Schema.Struct({ enabled: Schema.Boolean, required: Schema.Boolean }),
  }),
};

export const twoFactorStateAtom = Atom.make(
  Effect.promise(() => authClient.getSession()).pipe(
    Effect.map((result) => {
      const user = result.data?.user as
        | { readonly twoFactorEnabled?: boolean | null; readonly role?: string | null; }
        | undefined;

      return {
        enabled: user?.twoFactorEnabled === true,
        // Staff can read every customer's data, so the screen says so. Whether
        // the admin panel actually demands it is `ADMIN_REQUIRE_2FA`, which is
        // the server's business and off by default.
        required: user?.role === "admin",
      };
    }),
  ),
).pipe(Atom.serializable(twoFactorSerial));
