import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";

/** One unit of work, as it travels to the queue. */
export type QueuedJob = {
  readonly id: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly maxAttempts: number;
};

/**
 * The only push failure a caller can act on: the queue is unreachable, so the
 * events stay unrelayed and the next pass will try again. Anything else — a
 * malformed job, a broken connection string — is a defect.
 */
export class QueueUnavailable extends Schema.TaggedError<QueueUnavailable>()("QueueUnavailable", {
  reason: Schema.Literals(["Unreachable", "Rejected"]),
}) {}

export interface JobQueueService {
  readonly push: (job: QueuedJob) => Effect.Effect<void, QueueUnavailable>;
  /** What has been pushed, for the in-memory implementation to be asserted on. */
  readonly pushed: Effect.Effect<ReadonlyArray<QueuedJob>>;
}

export class JobQueue extends Context.Service<JobQueue, JobQueueService>()("JobQueue") {
  /**
   * Holds jobs in memory and hands them back.
   *
   * Not only a test double: it is what makes a fresh clone runnable without
   * Redis, the same way the mailer writes to the log without a Resend key. The
   * repository's rule is that every external boundary ships a layer needing no
   * credentials, and this is the one for the queue.
   */
  static layerMemory: Layer.Layer<JobQueue> = Layer.sync(JobQueue)(() => {
    const jobs: Array<QueuedJob> = [];

    return {
      push: (job) => Effect.sync(() => void jobs.push(job)),
      pushed: Effect.sync(() => [...jobs]),
    };
  });

  /**
   * Redis, when `REDIS_URL` is set; memory when it is not.
   *
   * Chosen from the environment rather than from `NODE_ENV`, so a deployment
   * that forgets the variable degrades to a visible in-memory queue rather than
   * failing to boot with nothing to show for it. The BullMQ implementation is
   * wired in `Bull.ts`, which this file deliberately does not import — a package
   * that pulls in Redis to run its tests is a package nobody runs tests on.
   */
  static layer: Layer.Layer<JobQueue> = Layer.unwrap(
    Effect.gen(function*() {
      const url = yield* Config.option(Config.redacted("REDIS_URL"));

      if (Option.isNone(url) || Redacted.value(url.value).trim() === "") {
        return JobQueue.layerMemory;
      }

      const { layerBullMq } = yield* Effect.promise(() => import("./Bull.js"));

      return layerBullMq(Redacted.value(url.value));
    }).pipe(Effect.orDie),
  );
}
