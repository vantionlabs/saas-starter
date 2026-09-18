import { Effect, Layer } from "effect";
import { JobQueue, QueueUnavailable } from "./JobQueue.js";

/**
 * The Redis-backed queue.
 *
 * In its own file, imported dynamically by `JobQueue.layer`, so that a process
 * with no `REDIS_URL` never loads BullMQ or opens a connection — and so the
 * tests for the outbox and the relay need no Redis to run.
 *
 * BullMQ owns scheduling, retries, concurrency and the dashboard, which is
 * exactly the part not worth rebuilding on Postgres. The part that *is* worth
 * keeping on Postgres is the outbox, because only it can commit with the write
 * it describes.
 */
export const layerBullMq = (url: string): Layer.Layer<JobQueue> =>
  Layer.effect(JobQueue)(
    Effect.gen(function*() {
      const { Queue } = yield* Effect.promise(() => import("bullmq"));

      const queue = yield* Effect.acquireRelease(
        Effect.sync(() => new Queue("jobs", { connection: { url } })),
        (open) => Effect.promise(() => open.close()).pipe(Effect.ignore),
      );

      return {
        push: (job) =>
          Effect.tryPromise({
            try: () =>
              queue.add(job.kind, job.payload, {
                jobId: job.id,
                attempts: job.maxAttempts,
                backoff: { type: "exponential", delay: 1_000 },
                removeOnComplete: { age: 86_400 },
                removeOnFail: false,
              }),
            // Redis being unreachable leaves the events unrelayed, which the next
            // pass retries. That is the one failure the relay can act on.
            catch: () => new QueueUnavailable({ reason: "Unreachable" }),
          }).pipe(Effect.asVoid),

        // BullMQ owns the jobs once pushed; asking this instance what it sent
        // would be asking the wrong thing.
        pushed: Effect.succeed([]),
      };
    }),
  ).pipe(Layer.orDie);
