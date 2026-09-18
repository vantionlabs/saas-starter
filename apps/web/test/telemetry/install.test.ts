import { installClientTelemetry } from "@/telemetry/install.js";
import type { ClientReporter, Vital } from "@/telemetry/Reporter.js";
import { consoleReporter, reporter, resetReporter, setReporter } from "@/telemetry/Reporter.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const collecting = () => {
  const errors: Array<{ error: unknown; context?: Record<string, unknown>; }> = [];
  const vitals: Array<Vital> = [];

  const collector: ClientReporter = {
    error: (error, context) => void errors.push({ error, ...(context && { context }) }),
    vital: (vital) => void vitals.push(vital),
  };

  setReporter(collector);

  return { errors, vitals };
};

let dispose: () => void = () => {};

/** Each test installs its own, and takes it down again with the undo it returns. */
const install = (
  subscribeVitals: Parameters<typeof installClientTelemetry>[0] extends
    { readonly subscribeVitals?: infer S; } | undefined ? S : never,
) => {
  dispose = installClientTelemetry({ subscribeVitals });
};

afterEach(() => {
  dispose();
  dispose = () => {};
  resetReporter();
  vi.restoreAllMocks();
});

describe("client telemetry", () => {
  /**
   * The failures a React error boundary never sees: a rejected promise nobody
   * awaited, and a handler that threw. Without these listeners the only record
   * is a console line the person who hit it will never send you.
   */
  it("reports an unhandled rejection", () => {
    const { errors } = collecting();
    install(() => {});

    const reason = new Error("the RPC never resolved");
    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]?.error).toBe(reason);
    expect(errors[0]?.context).toEqual({ kind: "unhandledrejection" });
  });

  it("reports an uncaught error", () => {
    const { errors } = collecting();
    install(() => {});

    const error = new Error("undefined is not a function");
    window.dispatchEvent(Object.assign(new Event("error"), { error }));

    expect(errors[0]?.error).toBe(error);
    expect(errors[0]?.context).toEqual({ kind: "window.error" });
  });

  it("forwards web vitals as they arrive", () => {
    const { vitals } = collecting();

    install((onVital) => {
      onVital({ name: "LCP", value: 2400, rating: "needs-improvement" });
      onVital({ name: "CLS", value: 0.02, rating: "good" });
    });

    expect(vitals.map((vital) => vital.name)).toEqual(["LCP", "CLS"]);
    expect(vitals[0]?.rating).toBe("needs-improvement");
  });

  /**
   * The root component's effect runs again on every hot update in development,
   * and a second set of listeners would report every error twice — which looks
   * exactly like a bug happening twice.
   */
  it("installs once, however many times it is called", () => {
    const { errors } = collecting();

    install(() => {});
    installClientTelemetry({ subscribeVitals: () => {} });

    window.dispatchEvent(Object.assign(new Event("error"), { error: new Error("once") }));

    expect(errors).toHaveLength(1);
  });
});

describe("the reporter without a DSN", () => {
  it("writes the error to the console, because the boundary swallowed it", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    consoleReporter.error(new Error("boom"), { kind: "route-boundary" });

    expect(logged).toHaveBeenCalledOnce();
  });

  /**
   * Three numbers from one page load on one machine are not data. Vitals are
   * only worth anything aggregated, so the credential-free path drops them
   * rather than filling the console with noise nobody can act on.
   */
  it("drops vitals rather than printing them", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});

    consoleReporter.vital({ name: "LCP", value: 1000, rating: "good" });

    expect(logged).not.toHaveBeenCalled();
    expect(debugged).not.toHaveBeenCalled();
  });

  it("is what the shared reporter delegates to until something replaces it", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    reporter.error(new Error("early"), undefined);

    expect(logged).toHaveBeenCalledOnce();
  });
});
