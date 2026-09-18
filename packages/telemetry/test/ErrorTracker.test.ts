import { ErrorTracker, layerReporting, type Report } from "@/ErrorTracker.js";
import { describe, expect, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Layer } from "effect";

const collecting = (into: Array<Report>) =>
  Layer.succeed(ErrorTracker)({
    capture: (report) => Effect.sync(() => void into.push(report)),
  });

/** Runs `self` with the reporting logger installed over a collecting tracker. */
const reported = <A, E>(self: Effect.Effect<A, E>) =>
  Effect.gen(function*() {
    const reports: Array<Report> = [];

    yield* self.pipe(
      Effect.provide(layerReporting("test").pipe(Layer.provide(collecting(reports)))),
    );

    // The logger forks its capture, so let the forked fiber run before reading.
    yield* Effect.yieldNow;

    return reports;
  });

describe("reporting", () => {
  it.effect("reports an error-level log", () =>
    Effect.gen(function*() {
      const reports = yield* reported(Effect.logError("the relay could not reach Redis"));

      expect(reports).toHaveLength(1);
      expect(reports[0]?.message).toContain("could not reach Redis");
      expect(reports[0]?.source).toBe("test");
    }));

  /**
   * The distinction the whole port exists for. An error tracker that also
   * collected `info` would report a deploy as an incident, and the counts —
   * which are the only reason to have one — would mean nothing.
   */
  it.effect("ignores everything below error", () =>
    Effect.gen(function*() {
      const reports = yield* reported(
        Effect.all([
          Effect.logInfo("worker started"),
          Effect.logWarning("retrying"),
          Effect.logDebug("drained 0"),
        ]),
      );

      expect(reports).toHaveLength(0);
    }));

  it.effect("carries the cause, not just the message", () =>
    Effect.gen(function*() {
      const boom = new Error("connection reset");

      const reports = yield* reported(Effect.logError("delivery failed", Cause.die(boom)));

      expect(reports).toHaveLength(1);
      expect(Cause.squash(reports[0]!.cause)).toBe(boom);
    }));

  it.effect("reports a fiber that died, which nothing logs by hand", () =>
    Effect.gen(function*() {
      const reports = yield* reported(
        Effect.logError("unhandled", Cause.die("the database went away")),
      );

      expect(Cause.squash(reports[0]!.cause)).toBe("the database went away");
    }));
});

describe("ErrorTracker.layer", () => {
  /**
   * The fresh-clone path: no DSN, no SDK loaded, and capture succeeds rather
   * than failing. A starter whose first run crashes for want of an error
   * tracker has the relationship backwards.
   */
  it.effect("is a no-op without SENTRY_DSN", () =>
    Effect.gen(function*() {
      const tracker = yield* ErrorTracker;

      expect(
        yield* tracker.capture({ message: "nothing listens", cause: Cause.empty, source: "test" }),
      ).toBeUndefined();
    }).pipe(
      Effect.provide(ErrorTracker.layer),
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({}))),
    ));
});
