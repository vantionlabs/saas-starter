# Background jobs

Two halves, and only one of them is ours.

## The shape

|                  | Where                                     | What it guarantees                                 |
| ---------------- | ----------------------------------------- | -------------------------------------------------- |
| `Outbox.enqueue` | Postgres, inside the caller's transaction | the job and the write it describes commit together |
| `Relay`          | `apps/worker`                             | committed rows reach the queue, at least once      |
| `JobQueue`       | BullMQ with `REDIS_URL`, memory without   | scheduling, retries, concurrency, a dashboard      |

The first is the part that cannot be bought. A queue in Redis cannot offer it:
it is a second system, and a crash between the write and the push leaves one of
them wrong, usually the one nobody is watching. `outboxEvent` has a `with check`
that refuses a row filed against no tenant, so enqueueing outside a scoped
transaction is loud rather than silent.

The third is a dependency, and dependencies get reconsidered. This page records
one such reconsideration so the next person does not repeat it.

## effect-mq, evaluated 2026-09-21

[effect-mq](https://www.effect-mq.com) is an Effect v4 native job library:
schema-first job definitions, handlers as fibers, and three stores (Postgres
through drizzle, Redis through Lua scripts, memory). It is the closest thing
there is to what this repository would have written, and it is not adopted.

**Verdict: a better fit for this repository's grain than BullMQ is, and too
young to take. Revisit, do not adopt.**

### What it would replace

Not the outbox, at first glance: BullMQ here is only delivery, so effect-mq
would swap `Bull.ts` and the `REDIS_URL` branch in `JobQueue.ts` for a library
that speaks Effect natively.

At second glance it could replace the outbox too, which is what makes it worth a
page. Its plain enqueue path is one statement on the ambient client
(`DrizzleJobStore.ts:935`, `insertJob(db, request, now)`), and `db` is
`PgDrizzle.makeWithDefaults()` over `@effect/sql-pg`. An enqueue called inside
`withOrgScope` would therefore join that transaction and commit with the domain
write, which is exactly the property `outboxEvent` exists to provide, with cron,
flows and cancellation on top of it.

**The documentation never claims this.** The enqueueing guide does not mention
transactions at all, and says of batches: "The batch is **not** one transaction,
by design: a mid-batch store failure can leave a subset enqueued." So the
guarantee this module is built around would rest on an undocumented property of
a 0.7 library, unasserted by its own conformance suite. That is the wrong thing
to infer from reading somebody's source.

### Why not yet

**Drizzle.** `effect-mq/drizzle-postgres` requires `drizzle-orm` v1 RC, its
seven tables declared as drizzle schema factories, and migrations through
`drizzle-kit generate`. This repository has no drizzle anywhere: raw SQL
migrations, `@effect/sql-pg`, RLS policies written by hand in `0002_rls.sql`.
Adding it means a second schema authority and a second migration pipeline. The
library's own source carries the fix as a TODO: "a standalone non-drizzle
Postgres driver on plain `@effect/sql-pg` (same table layout)".

**Age.** First published 2026-08-20. Eleven versions in five days, then nothing
since 2026-08-25. No stability statement in the README or the roadmap. Its peer
range is `effect >=4.0.0-rc <5`, so it tracks the same release candidate this
repository pins, which cuts both ways.

**Tenancy.** Seven tables outside this repository's RLS convention, with
`payload` jsonb holding tenant data and a claim path of `FOR UPDATE SKIP LOCKED`
straight on the table. effect-mq has no notion of a tenant, so those policies
would be ours to write against somebody else's schema, and to keep correct
across their migrations.

**No dashboard.** bull-board was a stated reason for choosing BullMQ. A
reference dashboard is under "maybe" on the effect-mq roadmap.

### What it is better at

Every one of these is a real gap here, not a feature comparison:

- handler timeouts, and cancellation across processes
- graceful shutdown, returning in-flight jobs to `waiting` without spending an
  attempt
- repeatable and scheduled jobs, which this repository has none of
- parent-child flows
- a persisted attempt ledger, where `outboxEvent` records only whether a row
  was relayed and every attempt after that lives in Redis
- deduplication and idempotency keys as primitives
- `LISTEN/NOTIFY` wake-ups, queue-filtered, in place of the relay's poll

It would also delete BullMQ, ioredis, `Bull.ts`, the dynamic import that keeps
BullMQ out of processes that do not need it, and the two `external` lines in the
worker and MCP Vite configs.

The jobs module is about three hundred lines. effect-mq is fifteen thousand. The
day this repository needs cron or flows is the day it starts writing a fraction
of that.

### Revisit when

Both, not either:

1. the standalone `@effect/sql-pg` driver lands, so no drizzle and no second
   migration pipeline, and
2. there is a 1.0, or six months of steady releases behind it.

At that point the question is not "replace BullMQ" but "replace BullMQ and the
outbox", and the answer may well be yes. Until then `Bull.ts` stays, and the
transactional guarantee stays in a table this repository owns.
