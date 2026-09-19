import { Schema } from "effect";

/**
 * Storage's failures, in a file that imports nothing.
 *
 * They live apart from `ObjectStore.ts` for the reason `BillingErrors.ts`
 * exists: the RPC contract declares them, both ends of the application compile
 * against that contract, and `ObjectStore.ts` reaches `node:crypto` and
 * `node:fs` through a dynamic import that a bundler follows. The web build
 * tolerated it; Metro refused outright, which was the honest answer — a phone
 * has no filesystem module to give it.
 */

/** Storage is unreachable, or refused. Both mean "try again", not "give up". */
export class StorageUnavailable
  extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {
    reason: Schema.Literals(["Unreachable", "Rejected", "NotConfigured"]),
  })
{}
