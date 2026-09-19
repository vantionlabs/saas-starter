import { dispatch } from "#src/Handlers.js";
import { NodeRuntime } from "@effect/platform-node";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { JobQueue } from "@vantion/module-jobs/JobQueue";
import { relayOnce } from "@vantion/module-jobs/Relay";
import { WebhooksModule } from "@vantion/module-webhooks/Module";
import { ErrorTracker, layerReporting } from "@vantion/telemetry/ErrorTracker";
import { layerTelemetry } from "@vantion/telemetry/Telemetry";
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

  /**
   * Jobs in parallel, bounded here and bounded again where they reach the
   * network.
   *
   * This was a sequential loop, which is bounded and slow in the worst way: one
   * webhook receiver that accepts the connection and then sits there stalled
   * every job behind it for the length of the timeout, so one customer's wedged
   * server delayed everybody's. `Outbound` is what stops this number and the
   * per-event fan-out multiplying into more sockets than anybody chose.
   */
  yield* Effect.forEach(waiting, (job) =>
    // One job failing is not a reason to stop the loop or to skip the rest. The
    // log is also the report: `layerReporting` turns every error-level entry
    // into one, so a job that fails all night is an issue with a count on it
    // rather than a thousand lines nobody reads.
    dispatch(job).pipe(
      Effect.catchCause((cause) => Effect.logError(`job ${job.id} (${job.kind}) failed`, cause)),
      Effect.withSpan("job.dispatch", { attributes: { "job.kind": job.kind, "job.id": job.id } }),
    ), { concurrency: 10 });

  return { relayed, dispatched: waiting.length };
});

const WorkerLive = Layer.effectDiscard(
  Effect.gen(function*() {
    yield* Effect.logInfo("worker started");

    yield* tick.pipe(
      Effect.withSpan("worker.tick"),
      Effect.repeat(Schedule.spaced("1 second")),
    );
  }),
).pipe(
  Layer.provide(JobQueue.layer),
  Layer.provide(WebhooksModule),
  Layer.provide(PgLive),
  Layer.provide(PgPool.layer),
);

/**
 * The worker is instrumented for the same reason the API is, and it went
 * without for longer: background delivery is the part most likely to fail
 * quietly, because nobody is watching a response while it does.
 *
 * It names itself `vantion-worker` so its spans do not merge with the API's.
 * Two services reporting under one name is a trace nobody can read.
 */
NodeRuntime.runMain(
  Layer.launch(WorkerLive).pipe(
    Effect.provide(layerTelemetry("vantion-worker")),
    Effect.provide(layerReporting("worker").pipe(Layer.provide(ErrorTracker.layer))),
  ),
);
