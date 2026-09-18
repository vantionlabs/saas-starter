import { Entitlement, Feature, features, free, has, limits, Plan } from "@/identity/Entitlement.js";
import { describe, expect, it } from "vitest";

const plans = Plan.literals;
const allFeatures = Feature.literals;

describe("plans", () => {
  /**
   * The lattice test, and the one worth having.
   *
   * The plans nest, so an upgrade can only add. The moment they stop nesting,
   * moving from pro to scale can silently take something away — and nobody finds
   * out until a customer does, having just paid more for less.
   */
  it("nest, so an upgrade never removes anything", () => {
    for (const [cheaper, dearer] of [["free", "pro"], ["pro", "scale"]] as const) {
      for (const carried of features[cheaper]) {
        expect(has(dearer, carried), `${dearer} lost ${carried} from ${cheaper}`).toBe(true);
      }
    }
  });

  it("raise every limit as they go up", () => {
    for (const [cheaper, dearer] of [["free", "pro"], ["pro", "scale"]] as const) {
      for (const key of ["seats", "apiKeys", "webhookEndpoints"] as const) {
        expect(limits[dearer][key], `${dearer}.${key}`)
          .toBeGreaterThanOrEqual(limits[cheaper][key]);
      }
    }
  });

  /** A feature no plan carries is a feature nobody can ever buy. */
  it("between them carry every feature", () => {
    for (const capability of allFeatures) {
      expect(
        plans.some((plan) => has(plan, capability)),
        `${capability} is on no plan`,
      ).toBe(true);
    }
  });

  /**
   * Which features sit on which plan is a pricing decision, so the tests assert
   * the structural properties rather than the choices: they nest, they raise
   * every limit, and between them they carry everything. Changing the split
   * should not break this file.
   */
  it("leave something for the paid plans to carry", () => {
    expect(features.free.size).toBeLessThan(features.scale.size);
  });
});

describe("entitlement", () => {
  const on = (status: Entitlement["status"]) =>
    new Entitlement({ plan: "scale", status, seats: 250 });

  /**
   * A card that failed this morning is usually a card that succeeds this
   * afternoon. Locking someone out of the product they are trying to pay for is
   * how a billing problem becomes a churn problem.
   */
  it("keeps a past-due subscription entitled", () => {
    expect(on("past_due").effectivePlan).toBe("scale");
  });

  it("keeps a trial entitled", () => {
    expect(on("trialing").effectivePlan).toBe("scale");
  });

  /**
   * Falls back to free rather than to nothing. Removing access outright would
   * take the audit trail and the export with it, which is exactly the data
   * somebody needs when they have stopped paying.
   */
  it("falls back to free when the subscription has ended", () => {
    for (const status of ["canceled", "incomplete"] as const) {
      expect(on(status).effectivePlan, status).toBe("free");
      expect(on(status).limits, status).toEqual(limits.free);
    }
  });

  it("gives an organization that never paid the free plan", () => {
    expect(free.effectivePlan).toBe("free");
    expect(free.limits.seats).toBe(limits.free.seats);
  });
});
