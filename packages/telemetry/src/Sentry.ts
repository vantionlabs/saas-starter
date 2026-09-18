import { Cause, Effect, Layer } from "effect";
import { ErrorTracker } from "./ErrorTracker.js";

/**
 * The live tracker.
 *
 * In its own file, imported dynamically by `ErrorTracker.layer`, so a process
 * with no `SENTRY_DSN` never loads the SDK — and so the tests for the reporting
 * seam need no Sentry account.
 */
export const layerSentry = (options: {
  readonly dsn: string;
  readonly environment: string;
  readonly release: string | undefined;
}): Layer.Layer<ErrorTracker> =>
  Layer.effect(ErrorTracker)(
    Effect.gen(function*() {
      const Sentry = yield* Effect.promise(() => import("@sentry/node"));

      Sentry.init({
        dsn: options.dsn,
        environment: options.environment,
        ...(options.release === undefined ? {} : { release: options.release }),
        // Tracing is OpenTelemetry's job here, and it is already configured.
        // Turning Sentry's own on would mean two systems sampling the same
        // requests and disagreeing about which ones they kept.
        tracesSampleRate: 0,
      });

      return {
        capture: (report) =>
          Effect.sync(() => {
            /**
             * `squash` gives the defect if there is one and the typed error
             * otherwise, which is the value worth grouping on: Sentry groups by
             * exception type and stack, so handing it the original is what
             * makes two occurrences of one bug land on one issue rather than
             * four hundred lines of the same string.
             */
            const thrown = Cause.squash(report.cause);

            Sentry.withScope((scope) => {
              scope.setTag("source", report.source);
              scope.setContext("effect", {
                message: report.message,
                // The rendered cause, because a tagged error's own fields are
                // where the useful detail usually is and Sentry will not find
                // them on its own.
                cause: Cause.pretty(report.cause),
              });

              if (thrown === undefined) {
                Sentry.captureMessage(report.message, "error");
              } else {
                Sentry.captureException(thrown);
              }
            });
          }),
      };
    }),
  ).pipe(Layer.orDie);
