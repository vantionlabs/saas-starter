import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "./Identity.js";
import { withOrgScope } from "./OrgScope.js";

/**
 * How much of what a plan meters this organization is actually using.
 *
 * Counts live with the table, not with the plan. `@vantion/module-billing` is
 * what composes these into the screen, because metering is a billing question —
 * but what "a seat" means is an identity question, and a count written next to
 * the limit rather than next to the rows is the one that quietly stops matching
 * what the enforcement counts.
 *
 * That divergence is the failure worth naming: a screen saying two of three
 * seats while invitations are refused is worse than no screen, because it sends
 * somebody to support instead of to the upgrade button.
 */

/**
 * Accepted members, which is what better-auth's `membershipLimit` counts — a
 * pending invitation is not a seat yet. The two have to agree or the number on
 * screen is not the number being enforced.
 *
 * No `withOrgScope`: `member` carries no row-level security, for the reason
 * `0011_sso.sql` gives at length — better-auth writes it outside any scoped
 * transaction. The predicate is the organization the caller is in, which is
 * what keeps this honest.
 */
export const seatsUsedFor = Effect.fnUntraced(function*(orgId: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ count: string; }>`
    select count(*)::text as "count" from "member" where "organizationId" = ${orgId}
  `.pipe(Effect.orDie);

  return Number(rows[0]?.count ?? 0);
});

/**
 * The caller's own, which is what a screen asks for. Split from the one above
 * because the **seat check on SCIM provisioning** has no caller at all — an
 * identity provider pushing users arrives with a token and an organization and
 * nothing else — and a count that could only be taken from a session would
 * have meant a second copy of this query.
 */
export const seatsUsed = Effect.fnUntraced(function*() {
  const { orgId } = yield* CurrentUser;

  return yield* seatsUsedFor(orgId);
});

/** Keys that still exist. Revoking one deletes the row, so this is what is live. */
export const apiKeysUsed = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<{ count: string; }>`
    select count(*)::text as "count" from "apiKey" where "organizationId" = ${orgId}
  `).pipe(Effect.orDie);

  return Number(rows[0]?.count ?? 0);
});
