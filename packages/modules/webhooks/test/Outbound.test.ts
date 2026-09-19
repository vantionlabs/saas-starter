import { Outbound } from "@/Outbound.js";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Ref } from "effect";

/**
 * Counts how many of these are running at once, and remembers the worst.
 *
 * `Ref` rather than a plain number because the point is concurrency: a counter
 * that several fibers increment is exactly the thing that needs one.
 */
const tracked = (live: Ref.Ref<number>, peak: Ref.Ref<number>) =>
  Effect.gen(function*() {
    const now = yield* Ref.updateAndGet(live, (n) => n + 1);
    yield* Ref.update(peak, (high) => Math.max(high, now));
    yield* Effect.yieldNow;
    yield* Ref.update(live, (n) => n - 1);
  });

const peakUnder = (permits: string, tasks: number) =>
  Effect.gen(function*() {
    const live = yield* Ref.make(0);
    const peak = yield* Ref.make(0);
    const outbound = yield* Outbound;

    yield* Effect.forEach(
      Array.from({ length: tasks }, (_, i) => i),
      () => outbound.withPermit(tracked(live, peak)),
      { concurrency: "unbounded" },
    );

    return yield* Ref.get(peak);
  }).pipe(
    Effect.provide(Outbound.layer),
    Effect.provide(
      ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBHOOK_CONCURRENCY: permits })),
    ),
  );

describe("the outbound permit pool", () => {
  /**
   * The assertion that makes the semaphore worth having. Without it this is a
   * service that looks like a limit and is not one, which is the failure mode
   * of every unenforced bound.
   */
  it.effect("never runs more at once than it has permits", () =>
    Effect.gen(function*() {
      expect(yield* peakUnder("1", 8)).toBe(1);
      expect(yield* peakUnder("3", 12)).toBeLessThanOrEqual(3);
    }));

  /** And it does not serialise everything: a bound of three uses three. */
  it.effect("uses the permits it has", () =>
    Effect.gen(function*() {
      expect(yield* peakUnder("3", 12)).toBeGreaterThan(1);
    }));

  it.effect("is not a limit when it is explicitly unbounded", () =>
    Effect.gen(function*() {
      const live = yield* Ref.make(0);
      const peak = yield* Ref.make(0);
      const outbound = yield* Outbound;

      yield* Effect.forEach(
        Array.from({ length: 6 }, (_, i) => i),
        () => outbound.withPermit(tracked(live, peak)),
        { concurrency: "unbounded" },
      );

      expect(yield* Ref.get(peak)).toBeGreaterThan(1);
    }).pipe(Effect.provide(Outbound.layerUnbounded)));
});
