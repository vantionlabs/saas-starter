import type { Schema } from "effect";

/**
 * A kind of background work, declared once with the shape of its payload.
 *
 * Declared the way an `Rpc` is, and for the same reason: the thing that enqueues
 * and the thing that handles are usually written weeks apart, and a payload
 * agreed in prose drifts. Here a change to the schema breaks both ends at build
 * time.
 */
export interface Job<Kind extends string, Payload extends Schema.Top> {
  readonly kind: Kind;
  readonly payload: Payload;
  /**
   * How many times the queue will try before giving up and dead-lettering.
   *
   * Five by default, which is the right answer for anything talking to a network
   * it does not control and the wrong answer for anything that charges money.
   */
  readonly maxAttempts: number;
}

export const make = <const Kind extends string, Payload extends Schema.Top>(
  kind: Kind,
  options: {
    readonly payload: Payload;
    readonly maxAttempts?: number;
  },
): Job<Kind, Payload> => ({
  kind,
  payload: options.payload,
  maxAttempts: options.maxAttempts ?? 5,
});

/** Any job, for the places that hold a collection of them. */
export type AnyJob = Job<string, Schema.Top>;
