import type { ClientReporter } from "@/telemetry/Reporter.js";

/**
 * The browser reporter, in its own file so the SDK is only fetched by a build
 * that has a DSN to give it.
 *
 * `import()` is what makes that true: Vite splits this into a chunk of its own,
 * and a visitor to a deployment without `VITE_SENTRY_DSN` never downloads it.
 * Bundling it unconditionally would put ~30 kB in front of every first paint to
 * do nothing.
 */
export const makeSentryReporter = async (options: {
  readonly dsn: string;
  readonly environment: string;
  readonly release: string | undefined;
  readonly tracesSampleRate: number;
}): Promise<ClientReporter> => {
  const Sentry = await import("@sentry/browser");

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    ...(options.release === undefined ? {} : { release: options.release }),
    /**
     * Tracing carries the web vitals Sentry collects itself, and sampling it is
     * a cost decision rather than a correctness one — so it is configurable and
     * defaults low. The vitals this app reports explicitly go through
     * `reporter.vital` regardless, which is what keeps them available when the
     * sample rate is zero.
     */
    tracesSampleRate: options.tracesSampleRate,
    integrations: [Sentry.browserTracingIntegration()],
  });

  return {
    error: (error, context) => {
      Sentry.withScope((scope) => {
        if (context !== undefined) scope.setContext("detail", context);

        if (error instanceof Error) Sentry.captureException(error);
        else Sentry.captureMessage(String(error), "error");
      });
    },
    vital: (vital) => {
      // A measurement, not an issue. Sending it as an event would put a
      // perfectly ordinary page load in the same list as the crashes.
      Sentry.setMeasurement(vital.name, vital.value, vital.name === "CLS" ? "" : "millisecond");
    },
  };
};
