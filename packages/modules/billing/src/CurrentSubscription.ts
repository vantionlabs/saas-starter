import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { Effect, Option } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** The subscription row, as the read side of billing needs it. */
export type SubscriptionRow = {
  readonly stripeCustomerId: string;
  readonly plan: string;
  readonly status: string;
  readonly seats: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date | null;
};

/**
 * The caller's organization's subscription, if it has ever had one.
 *
 * Org-scoped rather than worker-scoped, unlike the entitlement resolver: this
 * runs inside a request that already knows who is asking, so row-level security
 * does its job instead of being stepped around.
 *
 * The `where` is not redundant with that policy, and the first draft of this
 * file left it out. A superuser — or any role with BYPASSRLS — ignores row-level
 * security even on a FORCEd table, which is exactly what the test database is
 * and what a managed Postgres often hands you. Relying on the policy alone meant
 * every organization read the first subscription row in the table, and the
 * repository's own rule says both, never either.
 *
 * `None` is the ordinary case, not an error: every organization exists before it
 * pays for anything, and most never will.
 */
export const currentSubscription = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<SubscriptionRow>`
    select "stripeCustomerId", "plan", "status", "seats",
           "cancelAtPeriodEnd", "currentPeriodEnd"
    from "subscription"
    where "organizationId" = ${orgId}
  `).pipe(Effect.orDie);

  return Option.fromUndefinedOr(rows[0]);
});
