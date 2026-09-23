import { Config, Context, Effect, Layer, Semaphore } from "effect";

/**
 * How many outbound requests this process will have in flight at once.
 *
 * Both loops that deliver webhooks were sequential — one endpoint at a time,
 * one job at a time — which is bounded, and slow in the worst way: a single
 * receiver that accepts the connection and then sits there holds up every other
 * endpoint and every other job behind it for the length of the timeout. One
 * customer's wedged server became everybody's delay.
 *
 * Making both concurrent fixes that and creates a different problem, because
 * the two multiply: ten jobs at once, each fanning out to five endpoints, is
 * fifty sockets. A `concurrency` option on either loop cannot see the other.
 *
 * A semaphore can. One permit pool for the process, taken around the HTTP call
 * itself, so the loops can be as parallel as they like and the number of
 * connections this worker opens is still a number somebody chose.
 */
export class Outbound extends Context.Service<Outbound, {
  /** Runs `self` once a permit is free, and gives the permit back after. */
  readonly withPermit: <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
}>()("Outbound") {
  static layer: Layer.Layer<Outbound> = Layer.effect(Outbound)(
    Effect.gen(function*() {
      const permits = yield* Config.Int("WEBHOOK_CONCURRENCY").pipe(
        Config.withDefault(20),
        Effect.orDie,
      );

      const semaphore = yield* Semaphore.make(Math.max(1, permits));

      return { withPermit: Semaphore.withPermits(semaphore, 1) };
    }),
  );

  /**
   * No limit, for tests and for anything that delivers one event and stops.
   * Not a default: a process that dispatches in a loop wants the real one.
   */
  static layerUnbounded: Layer.Layer<Outbound> = Layer.succeed(Outbound)({
    withPermit: (self) => self,
  });
}
