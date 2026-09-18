import { dispatch } from "#src/Handlers.js";
import { NodeRuntime } from "@effect/platform-node";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { JobQueue } from "@vantion/module-jobs/JobQueue";
import { relayOnce } from "@vantion/module-jobs/Relay";
import { WebhooksModule } from "@vantion/module-webhooks/Module";
import { Effect, Layer, Schedule } from "effect";

/**
 * One pass: move committed events into the queue, then do the work.
 *
 * Draining after the relay rather than dispatching inside it is the important
 * part. The relay runs in a transaction, and a handler that makes an HTTP call
 * would hold that transaction open for the length of somebody else's timeout —
 * which is how a slow customer becomes a database problem.
 *
 * With Redis the drain is empty and BullMQ's own worker does the work. Without
 * it the queue hands back what it is holding and this loop is the worker, which
 * is what makes a fresh clone able to deliver a webhook with no Redis at all.
 */
const tick = Effect.gen(function*() {
  const relayed = yield* relayOnce();
  const queue = yield* JobQueue;
  const waiting = yield* queue.drain;

  for (const job of waiting) {
    // One job failing is not a reason to stop the loop or to skip the rest.
    yield* dispatch(job).pipe(
      Effect.catchCause((cause) => Effect.logError(`job ${job.id} (${job.kind}) failed`, cause)),
    );
  }

  return { relayed, dispatched: waiting.length };
});

const WorkerLive = Layer.effectDiscard(
  Effect.gen(function*() {
    yield* Effect.logInfo("worker started");

    yield* tick.pipe(Effect.repeat(Schedule.spaced("1 second")));
  }),
).pipe(
  Layer.provide(JobQueue.layer),
  Layer.provide(WebhooksModule),
  Layer.provide(PgLive),
  Layer.provide(PgPool.layer),
);

NodeRuntime.runMain(Layer.launch(WorkerLive));
