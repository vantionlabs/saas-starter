import { authClient } from "@/iam/auth-client.js";
import type { Role } from "@vantion/module-iam/identity/Permission";
import { Data, Effect } from "effect";

/**
 * Inviting somebody goes through better-auth, not through an RPC of ours.
 *
 * It owns the invitation endpoints and the `invitation` table, and the **seat
 * limit is enforced inside them** — `membershipLimit` in `auth/Options.ts` is
 * asked per invitation. A procedure of ours in front would be a second
 * implementation of a check that an invitation created through better-auth's
 * own API walks straight past, which is the argument `/settings/sso` makes for
 * the same arrangement.
 */

/**
 * Running out of seats is named, and nothing else is.
 *
 * It is the one refusal here somebody can act on — the answer is an upgrade,
 * which is two clicks away — so it gets its own sentence and a link. Every
 * other way this fails is a permission or an outage, and telling somebody
 * which would not change what they do next.
 */
export class InviteFailed extends Data.TaggedError("InviteFailed")<{
  readonly reason: "NoSeats" | "Rejected";
  readonly message: string;
}> {}

interface AuthError {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
  readonly message?: string | undefined;
}

/** better-auth resolves with `{ error }` rather than rejecting, so this is a value to inspect. */
const orFail = (result: { readonly data: unknown; readonly error: AuthError | null; }) =>
  result.error === null ? Effect.void : Effect.fail(
    new InviteFailed(
      result.error.code === "ORGANIZATION_MEMBERSHIP_LIMIT_REACHED"
        ? {
          reason: "NoSeats",
          message: "Every seat on this plan is taken. Upgrade to invite somebody else.",
        }
        : {
          reason: "Rejected",
          message: result.error.message ?? "That invitation could not be sent.",
        },
    ),
  );

export const inviteMember = (input: { readonly email: string; readonly role: Role; }) =>
  Effect.promise(() => authClient.organization.inviteMember(input)).pipe(Effect.flatMap(orFail));
