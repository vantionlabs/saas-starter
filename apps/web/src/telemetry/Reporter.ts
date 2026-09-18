/**
 * One measurement of how the page felt, in the browser's own vocabulary.
 *
 * `rating` is the library's verdict against Google's thresholds rather than
 * ours. A number on its own needs a table to interpret; "poor" does not.
 */
export type Vital = {
  readonly name: string;
  readonly value: number;
  readonly rating: "good" | "needs-improvement" | "poor";
};

export interface ClientReporter {
  readonly error: (error: unknown, context?: Record<string, unknown>) => void;
  readonly vital: (vital: Vital) => void;
}

/**
 * The reporter for a deployment with no error tracker, which is every fresh
 * clone.
 *
 * It writes to the console rather than doing nothing, unlike its counterpart on
 * the server. The difference is where the failure lands: the API's logger has
 * already printed the entry by the time the tracker sees it, whereas a React
 * error boundary swallows what it catches — so without this line the crash a
 * user just saw leaves no trace at all.
 */
export const consoleReporter: ClientReporter = {
  error: (error, context) => {
    // The one deliberate console call in the application. Everything else logs
    // through Effect; this is the fallback sink itself, and it has nowhere else
    // to write.
    // oxlint-disable-next-line eslint/no-console
    console.error("[telemetry]", error, context ?? {});
  },
  // Vitals are not a console concern. Three numbers per page load, from one
  // browser, on one machine, tell nobody anything — they are only worth
  // anything aggregated, which is exactly what the console is not.
  vital: () => {},
};

/**
 * The live reporter, swapped in once it loads.
 *
 * Mutable on purpose. Loading the SDK is asynchronous and errors do not wait
 * for it, so everything reports through this indirection and whatever arrives
 * in the first few hundred milliseconds still reaches the console.
 */
let current: ClientReporter = consoleReporter;

export const reporter: ClientReporter = {
  error: (error, context) => current.error(error, context),
  vital: (vital) => current.vital(vital),
};

export const setReporter = (next: ClientReporter): void => {
  current = next;
};

/** Only for tests: puts the console reporter back. */
export const resetReporter = (): void => {
  current = consoleReporter;
};
