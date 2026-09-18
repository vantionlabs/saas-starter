import * as Job from "@/Job.js";
import { JobQueue } from "@/JobQueue.js";
import { enqueue } from "@/Outbox.js";
import { relayOnce } from "@/Relay.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

const ORG = "org_outbox";
const OTHER = "org_outbox_other";

const SendWelcome = Job.make("SendWelcome", {
  payload: Schema.Struct({ email: Schema.String }),
  maxAttempts: 3,
});

const asOrg = (org: string) =>
  Layer.succeed(CurrentUser)(
    new Identity({
      userId: UserId.make("user_outbox"),
      orgId: OrgId.make(org),
      email: "jobs@example.com",
      emailVerified: true,
      role: "owner",
      permissions: [],
    }),
  );

const live = Layer.mergeAll(JobQueue.layerMemory, asOrg(ORG)).pipe(
  Layer.provideMerge(PgLive),
  Layer.provideMerge(PgPoolTest),
);

const reset = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  for (const org of [ORG, OTHER]) {
    yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
               values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
  }
  yield* sql`delete from "outboxEvent" where "organizationId" in ${sql.in([ORG, OTHER])}`;
});

const rows = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  return yield* sql<
    { kind: string; payload: unknown; maxAttempts: number; relayedAt: Date | null; }
  >`
    select "kind", "payload", "maxAttempts", "relayedAt" from "outboxEvent"
    where "organizationId" = ${org} order by "createdAt"
  `;
});

describe.skipIf(testDbUrl() === undefined)("outbox", () => {
  it.layer(live)("enqueueing", (it) => {
    it.effect("writes the job with its payload and attempt policy", () =>
      Effect.gen(function*() {
        yield* reset();

        yield* withOrgScope(enqueue(SendWelcome, { email: "ada@example.test" }));

        const written = yield* rows(ORG);
        expect(written).toHaveLength(1);
        expect(written[0]?.kind).toBe("SendWelcome");
        expect(written[0]?.payload).toEqual({ email: "ada@example.test" });
        expect(written[0]?.maxAttempts).toBe(3);
        expect(written[0]?.relayedAt).toBeNull();
      }));

    /**
     * The property the whole table exists for.
     *
     * A queue in Redis cannot offer it: enqueueing there is a second system, and
     * a write that rolls back afterwards leaves a job that will run against a
     * change that never happened.
     */
    it.effect("leaves nothing behind when the transaction rolls back", () =>
      Effect.gen(function*() {
        yield* reset();

        yield* withOrgScope(
          Effect.gen(function*() {
            yield* enqueue(SendWelcome, { email: "rolled-back@example.test" });

            return yield* Effect.fail(new Error("the write failed after enqueueing"));
          }),
        ).pipe(Effect.ignore);

        expect(yield* rows(ORG)).toHaveLength(0);
      }));

    it.effect("keeps one organization's events out of another's", () =>
      Effect.gen(function*() {
        yield* reset();

        yield* withOrgScope(enqueue(SendWelcome, { email: "ours@example.test" }));

        expect(yield* rows(ORG)).toHaveLength(1);
        expect(yield* rows(OTHER)).toHaveLength(0);
      }));
  });

  it.layer(live)("relaying", (it) => {
    it.effect("pushes pending events and marks them relayed", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* withOrgScope(enqueue(SendWelcome, { email: "first@example.test" }));
        yield* withOrgScope(enqueue(SendWelcome, { email: "second@example.test" }));

        const moved = yield* relayOnce();
        const queue = yield* JobQueue;
        const pushed = yield* queue.pushed;

        expect(moved).toBeGreaterThanOrEqual(2);
        expect(pushed.filter((job) => job.kind === "SendWelcome").length).toBeGreaterThanOrEqual(2);
        expect((yield* rows(ORG)).every((row) => row.relayedAt !== null)).toBe(true);
      }));

    /** Relayed once, not once per pass. */
    it.effect("does not push the same event twice", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* withOrgScope(enqueue(SendWelcome, { email: "once@example.test" }));

        yield* relayOnce();
        const queue = yield* JobQueue;
        const after = (yield* queue.pushed).length;

        yield* relayOnce();

        expect((yield* queue.pushed).length).toBe(after);
      }));

    it.effect("carries the attempt policy the job was enqueued under", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* withOrgScope(enqueue(SendWelcome, { email: "policy@example.test" }));

        yield* relayOnce();
        const queue = yield* JobQueue;
        const job = (yield* queue.pushed).find((pushed) =>
          (pushed.payload as { email?: string; }).email === "policy@example.test"
        );

        expect(job?.maxAttempts).toBe(3);
      }));
  });
});
