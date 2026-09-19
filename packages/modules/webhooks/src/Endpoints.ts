import { withWorkerScope } from "@vantion/database/OrgScope";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { webhookEndpointsDisabled } from "@vantion/telemetry/Metrics";
import { Effect, Metric } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomBytes, randomUUID } from "node:crypto";

export type Endpoint = {
  readonly id: string;
  readonly organizationId: string;
  readonly url: string;
  readonly secret: string;
  readonly consecutiveFailures: number;
};

/** `whsec_` then 32 random bytes, so the prefix makes a leaked secret greppable. */
export const SECRET_PREFIX = "whsec_";

/** How many consecutive failures before an endpoint is switched off. */
export const FAILURE_LIMIT = 10;

/**
 * Registering where a tenant wants its events delivered.
 *
 * Scoped, like every other write: an endpoint belongs to the organization the
 * caller is in, and no request can point another tenant's events elsewhere.
 */
export const register = Effect.fnUntraced(function*(url: string) {
  const sql = yield* SqlClient.SqlClient;
  const id = randomUUID();
  const secret = `${SECRET_PREFIX}${randomBytes(32).toString("hex")}`;

  yield* withOrgScope(sql`
    insert into "webhookEndpoint" ("id", "organizationId", "url", "secret")
    values (${id}, current_setting('app.current_org', true), ${url}, ${secret})
  `).pipe(Effect.orDie);

  return { id, url, secret };
});

/**
 * The endpoints an event should go to.
 *
 * Worker-scoped, because a delivery job knows which organization the event
 * belongs to but has no session for it — the same escape `ApiKeyAuth` needs, and
 * for the same reason. The statement is one select and nothing else.
 */
export const activeFor = Effect.fnUntraced(function*(organizationId: string) {
  const sql = yield* SqlClient.SqlClient;

  return yield* withWorkerScope(
    sql<Endpoint>`
      select "id", "organizationId", "url", "secret", "consecutiveFailures"
      from "webhookEndpoint"
      where "organizationId" = ${organizationId} and "active" = true
    `,
  ).pipe(Effect.orDie);
});

/**
 * Records the outcome against the endpoint.
 *
 * A success resets the count; enough failures in a row switch the endpoint off.
 * Auto-disabling is the part everyone forgets, and the reason a receiver that
 * has been gone for a week stops costing an attempt a minute forever.
 */
export const recordOutcome = Effect.fnUntraced(function*(options: {
  readonly endpointId: string;
  readonly delivered: boolean;
}) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* withWorkerScope(
    options.delivered
      ? sql<
        { active: boolean; }
      >`update "webhookEndpoint" set "consecutiveFailures" = 0 where "id" = ${options.endpointId} returning "active"`
      : sql<{ active: boolean; }>`
        update "webhookEndpoint"
        set "consecutiveFailures" = "consecutiveFailures" + 1,
            "active" = ("consecutiveFailures" + 1) < ${FAILURE_LIMIT}
        where "id" = ${options.endpointId}
        returning "active"
      `,
  ).pipe(Effect.orDie);

  /**
   * Counted from what the statement returned rather than by reading the row
   * back: the update is the moment it happens, and a second query could see a
   * different answer.
   */
  if (!options.delivered && rows[0]?.active === false) {
    yield* Metric.update(webhookEndpointsDisabled, 1);
  }
});
