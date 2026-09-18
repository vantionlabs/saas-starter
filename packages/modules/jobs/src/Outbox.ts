import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import type { Job } from "./Job.js";

/**
 * Writing a job into the outbox, inside whatever transaction the caller is
 * already in.
 *
 * That is the whole point of the table. The row and the change it describes
 * commit together or not at all, so no job fires for a write that rolled back
 * and no committed write loses its job. Enqueueing straight into Redis cannot
 * offer that: it is a second system, and a crash between the two leaves one of
 * them wrong — usually the one nobody is watching.
 *
 * **Call it inside the caller's own `withOrgScope`**, alongside the statement it
 * describes. It deliberately does not open a transaction of its own: one that
 * did would commit separately, which is the exact failure the outbox exists to
 * prevent.
 *
 * Calling it outside a scoped transaction is not a silent mistake. The
 * organization comes from the transaction's own setting, so unscoped it is null,
 * and the table's `with check` refuses the row — a caller cannot file an event
 * against a tenant that is not theirs, and cannot file one against no tenant at
 * all by forgetting.
 */
export const enqueue = <Kind extends string, Payload extends Schema.Top>(
  job: Job<Kind, Payload>,
  payload: Payload["Type"],
) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;

    // A payload that does not match its own schema is a programming error, and
    // not something the caller can act on at the point of enqueue.
    const encoded = yield* Schema.encodeEffect(job.payload)(payload).pipe(Effect.orDie);

    yield* sql`
      insert into "outboxEvent" ("id", "organizationId", "kind", "payload", "maxAttempts")
      values (
        ${randomUUID()},
        current_setting('app.current_org', true),
        ${job.kind},
        ${JSON.stringify(encoded)}::jsonb,
        ${job.maxAttempts}
      )
    `.pipe(Effect.orDie);
  });
