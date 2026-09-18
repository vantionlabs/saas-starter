import { JobQueue } from "./JobQueue.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * Only the queue: the outbox is a function called inside somebody else's
 * transaction, and the relay is a fiber a worker chooses to run. Neither is a
 * service an application provides, and pretending otherwise would put a
 * background loop inside every process that merely wanted to enqueue something.
 */
export const JobsModule = JobQueue.layer;
