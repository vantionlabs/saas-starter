import { describe, expect, it } from "@effect/vitest";
import { featureLabels, Pricing } from "@vantion/ui/marketing/pricing";

const prices = {
  free: { price: "Free", cadence: "for one team" },
  pro: { price: "$49", cadence: "per month" },
  scale: { price: "$199", cadence: "per month" },
} as const;
import { render, screen } from "@testing-library/react";
import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import { features, limits } from "@vantion/module-iam/identity/Entitlement";

const plans: ReadonlyArray<Plan> = ["free", "pro", "scale"];

describe("the pricing table", () => {
  /**
   * The check this page exists to survive.
   *
   * A pricing table promising ten seats while the application enforces three is
   * the commonest lie on a software website, and it is always an accident:
   * somebody changed the plan and not the page. Here both read the same
   * declaration, and this fails the day that stops being true.
   */
  it("promises exactly the limits the product enforces", () => {
    render(<Pricing prices={prices} />);

    for (const plan of plans) {
      expect(screen.getByText(`${limits[plan].seats} seats`)).toBeInTheDocument();
      expect(screen.getByText(`${limits[plan].apiKeys} API keys`)).toBeInTheDocument();
    }
  });

  /**
   * Driven from the plan rather than from a list retyped here.
   *
   * The first version asserted a count of three and three literal labels, which
   * made adding `sso` to a plan fail a test about the *page*. Which features a
   * plan carries is a pricing decision; that every one of them is shown, and
   * shown with words, is the property this file is for.
   */
  it("lists every feature a plan actually carries", () => {
    render(<Pricing prices={prices} />);

    for (const plan of plans) {
      for (const feature of features[plan]) {
        const label = featureLabels[feature];

        expect(label, `${feature} has no label`).not.toBe("");
        expect(screen.getAllByText(new RegExp(label)).length, label).toBeGreaterThan(0);
      }
    }
  });

  it("shows every plan, so none can be quietly dropped", () => {
    render(<Pricing prices={prices} />);

    for (const plan of plans) expect(screen.getByText(plan, { exact: true })).toBeInTheDocument();
  });
});
