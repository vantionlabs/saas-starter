import { sessionsSerial } from "@/atom/account-atoms.js";
import { authClient } from "@/iam/auth-client.js";
import { asCaller } from "@/server/caller.js";
import { dehydrate } from "@/server/hydration.js";
import { createServerFn } from "@tanstack/react-start";

/**
 * Every session this account has open.
 *
 * The **token is dropped here**, not in the component: better-auth returns it
 * on each row, and it is the credential itself. Narrowing at the boundary is
 * what keeps it out of the dehydrated state the server writes into the page —
 * a list of live session tokens in the HTML would be the worst thing on this
 * screen, and it would be invisible.
 */
export const listAccountSessions = createServerFn({ method: "GET" }).handler(async () => {
  const result = await authClient.listSessions(asCaller());
  const rows = (result.data ?? []) as ReadonlyArray<Record<string, unknown>>;

  return dehydrate(
    sessionsSerial,
    rows.map((row) => ({
      id: String(row["id"]),
      createdAt: String(row["createdAt"]),
      expiresAt: String(row["expiresAt"]),
      ipAddress: typeof row["ipAddress"] === "string" ? row["ipAddress"] : null,
      userAgent: typeof row["userAgent"] === "string" ? row["userAgent"] : null,
    })),
  );
});
