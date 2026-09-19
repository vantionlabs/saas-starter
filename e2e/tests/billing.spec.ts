import { expect, test } from "../fixtures.js";

test.describe("billing", () => {
  /**
   * The e2e environment has no Stripe keys, which is the state a fresh clone is
   * in and the one most likely to be shipped by accident. What it must not do is
   * offer a button that fails when pressed.
   */
  test("a new organization is on the free plan, with no way to buy anything", async ({ signedIn }) => {
    await signedIn.goto("/settings/billing");

    await expect(signedIn.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(signedIn.getByText("Stripe is not configured")).toBeVisible();

    // The plans are described even when nothing can be bought — knowing what an
    // upgrade carries is the reason somebody opens this page at all.
    for (const plan of ["Free", "Pro", "Scale"]) {
      await expect(signedIn.getByText(plan, { exact: true }).first()).toBeVisible();
    }

    await expect(signedIn.getByRole("button", { name: /Choose/ })).toHaveCount(0);
    // Nothing was ever bought, so there is no Stripe customer to manage.
    await expect(signedIn.getByRole("button", { name: "Manage billing" })).toHaveCount(0);
  });

  /**
   * The number beside a limit is the reason somebody is on this page after
   * being refused something. A new organization is one member of three, no
   * keys of two, and nothing of a hundred megabytes.
   */
  test("shows where the organization stands against its plan", async ({ signedIn }) => {
    await signedIn.goto("/settings/billing");

    await expect(signedIn.getByRole("heading", { name: "Usage" })).toBeVisible();
    await expect(signedIn.getByText("1 of 3")).toBeVisible();
    await expect(signedIn.getByText("0 of 2")).toBeVisible();
    await expect(signedIn.getByText("0 MB of 100 MB")).toBeVisible();

    /** A bar with no value is a decoration; this one is read out loud. */
    await expect(signedIn.getByRole("progressbar", { name: "Members" }))
      .toHaveAttribute("aria-valuenow", "1");
  });

  /**
   * Rendered by the server, like every other read on these screens. Scripts are
   * stripped first: the router serialises every loader's result into the
   * document, so the numbers are in the HTML whether or not anything rendered
   * them.
   */
  test("counts arrive with the document", async ({ signedIn }) => {
    await signedIn.goto("/settings/billing");

    const response = await signedIn.request.get("/settings/billing");
    const markup = (await response.text())
      .replace(/<script[\s\S]*?<\/script>/g, "")
      /**
       * Comments too, which is not cosmetic. React separates adjacent text
       * nodes with `<!-- -->`, so the server writes `1<!-- --> of <!-- -->3`
       * and a search for what a person reads finds nothing — the test would
       * fail against markup that is perfectly correct.
       */
      .replace(/<!--[\s\S]*?-->/g, "");

    expect(markup).toContain("Usage");
    expect(markup).toContain("1 of 3");
    expect(markup).toContain("0 MB of 100 MB");
  });

  test("is reachable from the settings navigation", async ({ signedIn }) => {
    await signedIn.goto("/settings/general");

    await signedIn.getByRole("link", { name: "Billing" }).click();

    await expect(signedIn).toHaveURL(/\/settings\/billing$/);
    await expect(signedIn.getByRole("heading", { name: "Billing" })).toBeVisible();
  });
});
