import { Metric } from "effect";

/**
 * The numbers, which are the half of observability this repository did not
 * have.
 *
 * A span says what one request did. `ErrorTracker` says the same failure has
 * happened four hundred times since Tuesday. Neither answers "how deep is the
 * outbox right now" or "what fraction of deliveries are failing" — those are
 * aggregates over time, which is what a metric is and what neither of the other
 * two can be made into.
 *
 * Declared in one place rather than beside the code that updates them, for the
 * same reason the permission statements are: a name is a contract with whatever
 * is graphing it, and a metric renamed in one module and not another is a
 * dashboard that silently goes flat.
 *
 * Exported through the same OTLP endpoint as the traces (`OtelMetrics` in
 * `Telemetry.ts`), so there is one thing to configure and one place they land.
 */

/** Prefix on every metric here, so one deployment's series are one family. */
const name = (suffix: string) => `vantion_${suffix}`;

/**
 * Work waiting to be relayed, sampled by the worker each pass.
 *
 * A gauge rather than a counter: what matters is the depth *now*. A number that
 * climbs and does not come back down is the single clearest signal that the
 * relay has stopped, and until this existed the only way to see it was to go
 * and count the rows.
 */
export const outboxPending = Metric.gauge(name("outbox_pending"), {
  description: "Committed outbox events not yet handed to the queue.",
});

export const outboxRelayed = Metric.counter(name("outbox_relayed_total"), {
  description: "Outbox events moved into the queue.",
  incremental: true,
});

/**
 * Deliveries by outcome, which is the ratio anybody actually looks at.
 *
 * Attributes rather than three separate counters, so "what share failed" is one
 * query instead of arithmetic between series.
 */
export const webhookDeliveries = Metric.counter(name("webhook_deliveries_total"), {
  description: "Outbound webhook delivery attempts, by outcome.",
  incremental: true,
});

export const webhookEndpointsDisabled = Metric.counter(
  name("webhook_endpoints_disabled_total"),
  {
    description: "Endpoints switched off after consecutive failures.",
    incremental: true,
  },
);

/**
 * Every read that crossed the tenant boundary.
 *
 * `adminAudit` is the record of *which* ones and why; this is the shape of the
 * curve. A support surface that is used twice a day and suddenly is used two
 * hundred times is worth a page, and no row-level trail makes that visible on
 * its own.
 */
export const crossTenantReads = Metric.counter(name("cross_tenant_reads_total"), {
  description: "Admin reads that crossed the tenant boundary.",
  incremental: true,
});

/**
 * Requests refused by the rate limiter.
 *
 * On the OTP path the limit *is* the security boundary — `ClientAddress.ts`
 * says so — and a limiter that has stopped engaging looks exactly like one that
 * is not being tested.
 */
export const rateLimited = Metric.counter(name("rate_limited_total"), {
  description: "Requests refused by the auth rate limiter.",
  incremental: true,
});
