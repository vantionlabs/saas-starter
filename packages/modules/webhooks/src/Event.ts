import { Schema } from "effect";

/**
 * The events a tenant can subscribe to, declared once.
 *
 * A literal union rather than a free string, so adding a delivery means adding a
 * case here and the compiler finding every place that must handle it. A webhook
 * catalogue that drifts from what the product actually emits is worse than no
 * catalogue: customers build against the documentation.
 */
export const EventKind = Schema.Literals(["contact.created", "contact.deleted"]);
export type EventKind = typeof EventKind.Type;

/**
 * What a receiver is sent.
 *
 * `id` is the outbox row's id, and it is stable across retries — which is what
 * makes at-least-once delivery something a receiver can deduplicate rather than
 * something they have to tolerate.
 */
export const Envelope = Schema.Struct({
  id: Schema.String,
  type: EventKind,
  createdAt: Schema.String,
  data: Schema.Json,
});
export type Envelope = typeof Envelope.Type;
