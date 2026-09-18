import type { QueuedJob } from "@vantion/module-jobs/JobQueue";
import { deliver } from "@vantion/module-webhooks/Delivery";
import { Effect } from "effect";

/**
 * What to do with each kind of job.
 *
 * A plain switch rather than a registry service: there are few of them, they are
 * all in this file, and an unhandled kind should be a compile-time gap rather
 * than a lookup that returns undefined at three in the morning.
 *
 * Handlers must be idempotent. The relay is at-least-once by construction — a
 * crash between pushing and committing replays the batch — so every one of these
 * will eventually run twice.
 */
export const dispatch = Effect.fnUntraced(function*(job: QueuedJob) {
  switch (job.kind) {
    case "contact.created":
    case "contact.deleted": {
      // System events belong to no tenant, and a webhook has no one to go to.
      if (job.organizationId === null) return;

      yield* deliver({
        organizationId: job.organizationId,
        envelope: {
          id: job.id,
          type: job.kind,
          createdAt: job.createdAt.toISOString(),
          data: job.payload as never,
        },
      });

      return;
    }

    default:
      // Not a failure: a kind this build does not know about is one a newer
      // deploy will, and dead-lettering it would lose work a rollout is about to
      // handle. It stays relayed and is simply not delivered by this process.
      yield* Effect.logWarning(`no handler for job kind ${job.kind}`);
  }
});
