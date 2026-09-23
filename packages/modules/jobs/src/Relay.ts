import { withWorkerScope } from "@vantion/database/OrgScope";
import { outboxPending, outboxRelayed } from "@vantion/telemetry/Metrics";
import type { Duration } from "effect";
import { Effect, Metric, Schedule } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { JobQueue } from "./JobQueue.js";

/**
 * Moves committed outbox rows into the queue.
 *
 * Claims a batch with `for update skip locked`, pushes it, and marks it relayed
 * — all in one transaction. Two properties follow, and both are deliberate:
 *
 * **Nothing is lost.** If the push fails the transaction rolls back, the rows
 * stay unrelayed, and the next pass tries again.
 *
 * **Delivery is at-least-once.** A crash after the push but before the commit
 * relays those events a second time. The alternative — marking first — loses
 * them instead, and a duplicate a handler can be written to tolerate is a better
 * failure than a job that silently never ran. **Handlers must be idempotent.**
 *
 * `skip locked` is what lets more than one relay run at once without two of them
 * claiming the same row.
 */
export const relayOnce = Effect.fnUntraced(function*(options?: { readonly batchSize?: number; }) {
  const sql = yield* SqlClient.SqlClient;
  const queue = yield* JobQueue;
  const batchSize = options?.batchSize ?? 100;

  return yield* withWorkerScope(
    Effect.gen(function*() {
      const claimed = yield* sql<{
        id: string;
        organizationId: string | null;
        kind: string;
        payload: unknown;
        createdAt: Date;
        maxAttempts: number;
      }>`
        select "id", "organizationId", "kind", "payload", "createdAt", "maxAttempts"
        from "outboxEvent"
        where "relayedAt" is null
        order by "createdAt"
        for update skip locked
        limit ${batchSize}
      `;

      /**
       * Sampled here rather than in its own query, because the pass has to
       * count the remaining rows anyway to know whether it is keeping up. A
       * depth that climbs and never comes back down is the clearest sign the
       * relay has stopped, and it was invisible until this existed.
       */
      const [depth] = yield* sql<{ pending: bigint; }>`
        select count(*) as "pending" from "outboxEvent" where "relayedAt" is null
      `;

      yield* Metric.update(outboxPending, Number(depth?.pending ?? 0));

      if (claimed.length === 0) return 0;

      for (const row of claimed) {
        yield* queue.push({
          id: row.id,
          organizationId: row.organizationId,
          kind: row.kind,
          payload: row.payload,
          createdAt: row.createdAt,
          maxAttempts: row.maxAttempts,
        });
      }

      yield* sql`
        update "outboxEvent" set "relayedAt" = now()
        where "id" in ${sql.in(claimed.map((row) => row.id))}
      `;

      yield* Metric.update(outboxRelayed, claimed.length);

      return claimed.length;
    }),
  );
});

/**
 * The relay, running until its fiber is interrupted.
 *
 * A poll rather than `LISTEN`/`NOTIFY`: a notification is lost if nobody is
 * listening when it fires, which would leave an event stranded until the next
 * one happened to wake the relay. Polling a partial index costs almost nothing
 * and cannot miss a row.
 */
export const run = (
  options?: { readonly every?: Duration.Input; readonly batchSize?: number; },
) =>
  relayOnce({ ...(options?.batchSize === undefined ? {} : { batchSize: options.batchSize }) }).pipe(
    Effect.repeat(Schedule.spaced(options?.every ?? "1 second")),
  );
