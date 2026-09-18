import { Schema } from "effect";

/**
 * Billing's failures, in a file that imports nothing.
 *
 * They live apart from `StripeClient.ts` for a reason a type-checker cannot see.
 * The RPC contract declares them, both ends of the application compile against
 * that contract, and `StripeClient.ts` reaches the Stripe SDK through a dynamic
 * `import`. A bundler follows that import statically — so while a process
 * without a key never *runs* the SDK, the browser was being handed 135 kB of it
 * anyway. Keeping the errors in a leaf file is what stops a contract dragging an
 * implementation across the wire.
 */

/** Stripe is unreachable, or refused. Both mean "try again", not "give up". */
export class StripeUnavailable
  extends Schema.TaggedError<StripeUnavailable>()("StripeUnavailable", {
    reason: Schema.Literals(["Unreachable", "Rejected"]),
  })
{}

/** A webhook that did not come from Stripe, or did not survive the journey. */
export class WebhookRejected extends Schema.TaggedError<WebhookRejected>()("WebhookRejected", {
  reason: Schema.Literals(["BadSignature", "Unreadable"]),
}) {}
