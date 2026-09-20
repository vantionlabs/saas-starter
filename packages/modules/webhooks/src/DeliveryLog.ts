import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** How many attempts the screen shows. Enough to see a pattern, not a log file. */
export const RECENT_LIMIT = 50;

export type DeliveryRow = {
  readonly id: string;
  readonly endpointId: string;
  readonly eventId: string;
  readonly kind: string;
  readonly status: "pending" | "delivered" | "failed";
  readonly attempts: number;
  readonly responseStatus: number | null;
  readonly lastError: string | null;
  readonly at: Date;
};

/**
 * What was attempted lately, newest first.
 *
 * The table has existed since outbound delivery shipped and nothing has ever
 * read it — the log was written for a year before anything could open it, which
 * is the same failure `adminAudit` had. "Did you send it?" is the first question
 * a customer asks and this is the only thing that can answer it.
 *
 * The limit is a constant rather than a parameter, so the loader and the atom
 * cannot ask for different amounts and hydrate a list the other then replaces.
 */
export const recentForCaller = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  return yield* withOrgScope(sql<DeliveryRow>`
    select "id", "endpointId", "eventId", "kind", "status", "attempts",
           "responseStatus", "lastError", "at"
    from "webhookDelivery"
    where "organizationId" = ${orgId}
    order by "at" desc
    limit ${RECENT_LIMIT}
  `).pipe(Effect.orDie);
});
