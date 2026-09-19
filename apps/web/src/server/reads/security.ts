import { twoFactorSerial } from "@/atom/two-factor-atoms.js";
import { authClient } from "@/iam/auth-client.js";
import { asCaller } from "@/server/caller.js";
import { dehydrate } from "@/server/hydration.js";
import { createServerFn } from "@tanstack/react-start";

/**
 * Whether a second factor is on, and whether this account has no choice.
 *
 * Read from better-auth rather than from `Me`, because `twoFactorEnabled` and
 * the system `role` are fields its plugins own and write — copying them into
 * our `Identity` would be two places for one fact. That is also why this is not
 * a `serverRpc` call: there is no RPC in front of these endpoints, deliberately.
 */
export const getTwoFactorState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await authClient.getSession(asCaller());
  const user = session.data?.user as
    | { readonly twoFactorEnabled?: boolean | null; readonly role?: string | null; }
    | undefined;

  return dehydrate(twoFactorSerial, {
    enabled: user?.twoFactorEnabled === true,
    required: user?.role === "admin",
  });
});
