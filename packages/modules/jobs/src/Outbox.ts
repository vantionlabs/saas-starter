import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
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
 * Call it inside the same `sql.withTransaction` as the write it belongs to.
 * Calling it outside one is not an error, and not a guarantee either.
 *
 * The organization comes from the transaction's own setting rather than from a
 * parameter, so a caller cannot file an event against a tenant that is not
 * theirs — the same reason `withOrgScope` reads it instead of taking it.
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

    yield* withOrgScope(sql`
      insert into "outboxEvent" ("id", "organizationId", "kind", "payload", "maxAttempts")
      values (
        ${randomUUID()},
        current_setting('app.current_org', true),
        ${job.kind},
        ${JSON.stringify(encoded)}::jsonb,
        ${job.maxAttempts}
      )
    `).pipe(Effect.orDie);
  });
