import type { Vital } from "@/telemetry/Reporter.js";
import { reporter, setReporter } from "@/telemetry/Reporter.js";

/** Subscribing to the browser's own performance measurements. */
export type SubscribeVitals = (onVital: (vital: Vital) => void) => void;

const subscribeWebVitals: SubscribeVitals = (onVital) => {
  void import("web-vitals").then(({ onCLS, onINP, onLCP, onTTFB }) => {
    // The four that a product can actually act on: layout stability, input
    // responsiveness, how long the main content took, and how long the server
    // took before any of that could start.
    for (const observe of [onCLS, onINP, onLCP, onTTFB]) {
      observe((metric) =>
        onVital({ name: metric.name, value: metric.value, rating: metric.rating })
      );
    }
  });
};

let installed = false;

/**
 * Client error capture and web vitals, installed once per document.
 *
 * Called from the root component's effect rather than from a module top level,
 * because this file is imported during server rendering too and `window` is not
 * there. The guard below is belt and braces for the same reason.
 *
 * What it catches is what a React error boundary does not: a rejected promise
 * nobody awaited, an event handler that threw, a script that failed to parse.
 * `RouteCrash` reports the rest.
 *
 * Returns its own undo, which is what makes it safe as an effect: React invokes
 * effects twice in development, and a second pair of listeners would report
 * every error twice — indistinguishable from a bug happening twice.
 */
export const installClientTelemetry = (options?: {
  readonly subscribeVitals?: SubscribeVitals;
}): () => void => {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  const onError = (event: ErrorEvent) => {
    reporter.error(event.error ?? event.message, { kind: "window.error" });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    reporter.error(event.reason, { kind: "unhandledrejection" });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  (options?.subscribeVitals ?? subscribeWebVitals)((vital) => reporter.vital(vital));

  const dispose = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };

  const dsn = import.meta.env["VITE_SENTRY_DSN"];

  if (typeof dsn !== "string" || dsn.trim() === "") return dispose;

  void import("@/telemetry/Sentry.js").then(({ makeSentryReporter }) =>
    makeSentryReporter({
      dsn,
      environment: import.meta.env["VITE_SENTRY_ENVIRONMENT"] ?? "production",
      release: import.meta.env["VITE_RELEASE"],
      tracesSampleRate: Number(import.meta.env["VITE_SENTRY_TRACES_SAMPLE_RATE"] ?? 0.1),
    }).then(setReporter)
  );

  return dispose;
};
