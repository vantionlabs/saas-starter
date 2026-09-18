import { Cause, Config, Context, Effect, Layer, Logger, Option, Redacted } from "effect";

/** One thing that went wrong, as an error tracker needs it. */
export type Report = {
  readonly message: string;
  readonly cause: Cause.Cause<unknown>;
  /** The service that produced it: the API, the worker, a job's kind. */
  readonly source: string;
};

export interface ErrorTrackerService {
  readonly capture: (report: Report) => Effect.Effect<void>;
}

/**
 * Where failures go to be counted.
 *
 * Distinct from tracing on purpose. A span says what one request did; this says
 * that the same failure has happened four hundred times since Tuesday, which
 * release started it, and how many people it reached. Traces are not
 * aggregation, and the gap between them is what a deployment actually notices
 * an outage with.
 */
export class ErrorTracker extends Context.Service<ErrorTracker, ErrorTrackerService>()(
  "ErrorTracker",
) {
  /**
   * The layer for a deployment with no error tracker, which is every fresh
   * clone.
   *
   * It deliberately does nothing rather than logging: whatever reached here was
   * already logged by the logger that called it, and a second line saying the
   * same thing teaches people to ignore both.
   */
  static layerNoop: Layer.Layer<ErrorTracker> = Layer.succeed(ErrorTracker)({
    capture: () => Effect.void,
  });

  /**
   * Sentry when `SENTRY_DSN` is set, nothing when it is not.
   *
   * The SDK is imported dynamically, so a process without a DSN never loads it
   * — the same bargain the mailer makes without a Resend key and Stripe makes
   * without a secret.
   */
  static layer: Layer.Layer<ErrorTracker> = Layer.unwrap(
    Effect.gen(function*() {
      const dsn = yield* Config.option(Config.redacted("SENTRY_DSN"));

      if (Option.isNone(dsn) || Redacted.value(dsn.value).trim() === "") {
        return ErrorTracker.layerNoop;
      }

      const release = yield* Config.option(Config.nonEmptyString("RELEASE"));
      const environment = yield* Config.nonEmptyString("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("production"),
      );

      const { layerSentry } = yield* Effect.promise(() => import("./Sentry.js"));

      return layerSentry({
        dsn: Redacted.value(dsn.value),
        environment,
        release: Option.getOrUndefined(release),
      });
    }).pipe(Effect.orDie),
  );
}

/**
 * The seam: every log at `Error` or above is also a report.
 *
 * A logger rather than a call at each failure site, because `RULES.md` already
 * forbids manual logging on error paths — so the places that would have called
 * a tracker by hand do not exist, and what remains is the deliberate
 * `Effect.logError`s and whatever the runtime reports when a fiber dies. One
 * wiring point per process, and nothing for a handler's author to remember.
 *
 * `mergeWithExisting` keeps the console logger: the tracker is where a failure
 * is counted, and the log is still where somebody reads it during a deploy.
 */
export const layerReporting = (source: string): Layer.Layer<never, never, ErrorTracker> =>
  Logger.layer([
    Effect.map(ErrorTracker, (tracker) =>
      Logger.make<unknown, void>((options) => {
        if (options.logLevel !== "Error" && options.logLevel !== "Fatal") return;

        // Forked, not awaited: a logger cannot suspend the fiber that is
        // logging, and an error tracker being slow must not make the process
        // that is already failing any slower.
        Effect.runFork(tracker.capture({
          message: String(options.message),
          cause: options.cause,
          source,
        }));
      })),
  ], { mergeWithExisting: true });
