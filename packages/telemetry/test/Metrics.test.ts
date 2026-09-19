import { crossTenantReads, outboxPending, rateLimited, webhookDeliveries } from "@/Metrics.js";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Metric } from "effect";

/**
 * Names are a contract with whatever is graphing them.
 *
 * A metric renamed in one place and not the dashboard is a chart that silently
 * goes flat — the one failure mode where the code looks fine and the operator
 * is the last to know. So the names are asserted rather than assumed, which
 * makes renaming one a deliberate act with a failing test in front of it.
 */
describe("metric names", () => {
  it("are prefixed and stable", () => {
    expect(outboxPending.id).toBe("vantion_outbox_pending");
    expect(webhookDeliveries.id).toBe("vantion_webhook_deliveries_total");
    expect(crossTenantReads.id).toBe("vantion_cross_tenant_reads_total");
    expect(rateLimited.id).toBe("vantion_rate_limited_total");
  });
});

describe("the metrics themselves", () => {
  it.effect("count up, and a gauge takes the value it is given", () =>
    Effect.gen(function*() {
      yield* Metric.update(rateLimited, 1);
      yield* Metric.update(rateLimited, 1);

      expect((yield* Metric.value(rateLimited)).count).toBe(2);

      yield* Metric.update(outboxPending, 17);
      expect((yield* Metric.value(outboxPending)).value).toBe(17);
    }));

  /**
   * One series per outcome, which is why the attribute is on the counter
   * rather than there being two counters: "what share failed" has to be one
   * query, not arithmetic between two.
   */
  it.effect("keep outcomes apart on one counter", () =>
    Effect.gen(function*() {
      const delivered = Metric.withAttributes(webhookDeliveries, { outcome: "delivered" });
      const failed = Metric.withAttributes(webhookDeliveries, { outcome: "failed" });

      yield* Metric.update(delivered, 1);
      yield* Metric.update(failed, 1);
      yield* Metric.update(failed, 1);

      expect((yield* Metric.value(delivered)).count).toBe(1);
      expect((yield* Metric.value(failed)).count).toBe(2);
    }));
});
