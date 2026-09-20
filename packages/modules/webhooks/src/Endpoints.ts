import { withWorkerScope } from "@vantion/database/OrgScope";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
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

/** A row as a screen sees it: no secret, ever. */
export type EndpointRow = {
  readonly id: string;
  readonly url: string;
  readonly active: boolean;
  readonly consecutiveFailures: number;
  readonly createdAt: Date;
};

/**
 * The caller's own endpoints, for the settings screen.
 *
 * The select names its columns rather than taking `*`, which is the whole of
 * keeping the secret out: a screen reads this, hydration serialises what a
 * screen reads into the page, and `select *` would put every tenant's signing
 * key into the HTML on every visit. Narrowing here rather than in the handler
 * means there is one place to get it wrong.
 */
export const listForCaller = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  return yield* withOrgScope(sql<EndpointRow>`
    select "id", "url", "active", "consecutiveFailures", "createdAt"
    from "webhookEndpoint"
    where "organizationId" = ${orgId}
    order by "createdAt" desc
  `).pipe(Effect.orDie);
});

/** How many this organization has, for the limit and for the usage screen. */
export const countForCaller = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<{ count: string; }>`
    select count(*)::text as "count" from "webhookEndpoint"
    where "organizationId" = ${orgId}
  `).pipe(Effect.orDie);

  return Number(rows[0]?.count ?? 0);
});

/**
 * A new secret on an endpoint that stays where it is.
 *
 * `returning "id"` is how "was there such a row" is answered, rather than a
 * select first: the update is scoped, so a row belonging to another tenant
 * matches nothing and comes back empty — indistinguishable, deliberately, from
 * an id that never existed. Asking first would be two statements and a window
 * between them.
 *
 * There is no overlap window: the next delivery is signed with the new secret.
 * Two live secrets would be kinder and is a second column, which `WebhooksRpc`
 * says plainly rather than this pretending otherwise.
 */
export const rotate = Effect.fnUntraced(function*(id: string) {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;
  const secret = `${SECRET_PREFIX}${randomBytes(32).toString("hex")}`;

  const rows = yield* withOrgScope(sql<{ id: string; }>`
    update "webhookEndpoint" set "secret" = ${secret}
    where "id" = ${id} and "organizationId" = ${orgId}
    returning "id"
  `).pipe(Effect.orDie);

  return rows.length === 0 ? undefined : secret;
});

/**
 * Deleting takes the delivery history with it, by the foreign key's cascade.
 *
 * Worth knowing rather than discovering: the reason to keep an endpoint and
 * rotate its secret is exactly that the attempts recorded against it are what
 * somebody is looking at when they decide to rotate.
 */
export const remove = Effect.fnUntraced(function*(id: string) {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<{ id: string; }>`
    delete from "webhookEndpoint"
    where "id" = ${id} and "organizationId" = ${orgId}
    returning "id"
  `).pipe(Effect.orDie);

  return rows.length > 0;
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
