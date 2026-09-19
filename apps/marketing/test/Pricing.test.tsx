import { product } from "@/product.js";
import { render } from "@/render.js";
import { Site } from "@/Site.js";
import { describe, expect, it } from "@effect/vitest";
import { render as mount, screen } from "@testing-library/react";
import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import { features, limits } from "@vantion/module-iam/identity/Entitlement";

const plans: ReadonlyArray<Plan> = ["free", "pro", "scale"];

describe("the pricing section", () => {
  /**
   * The check this page exists to survive.
   *
   * A pricing table promising ten seats while the application enforces three is
   * the commonest lie on a software website, and it is always an accident:
   * somebody changed the plan and not the page. Here both read the same
   * declaration, and this fails the day that stops being true.
   */
  it("promises exactly the limits the product enforces", () => {
    mount(<Site />);

    for (const plan of plans) {
      expect(screen.getByText(`${limits[plan].seats} seats`)).toBeInTheDocument();
      expect(screen.getByText(`${limits[plan].apiKeys} API keys`)).toBeInTheDocument();
    }
  });

  it("lists every feature a plan actually carries", () => {
    mount(<Site />);

    // `scale` has all three, so the labels are asserted against its set.
    expect([...features.scale]).toHaveLength(3);

    for (const label of ["Public API and keys", "Custom roles", "Outbound webhooks"]) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
  });

  it("shows every plan the product has, so none can be quietly dropped", () => {
    mount(<Site />);

    for (const plan of plans) {
      expect(screen.getByText(plan, { exact: true })).toBeInTheDocument();
    }
  });
});

describe("the page", () => {
  it("says what it sells and where to start", () => {
    mount(<Site />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(product.tagline);
    expect(screen.getByRole("link", { name: /Start free/ })).toHaveAttribute(
      "href",
      product.appUrl,
    );
  });

  it("answers its questions in its own words rather than leaving lorem ipsum", () => {
    mount(<Site />);

    for (const entry of product.faq) {
      expect(screen.getByText(entry.q)).toBeInTheDocument();
    }
  });
});

describe("the prerendered page", () => {
  /**
   * The build writes this markup into `index.html`, so a crawler and a link
   * preview see the page without running anything. Asserting on the function
   * rather than the built file keeps it in the ordinary test run — a check
   * that only works after `pnpm build` is a check nobody runs.
   */
  it("contains the copy and the real limits before any JavaScript runs", () => {
    const markup = render();

    expect(markup).toContain(product.tagline);
    expect(markup).toContain(`${limits.free.seats} seats`);
    expect(markup).toContain(`${limits.scale.seats} seats`);
    expect(markup).toContain("Start free");
  });
});
