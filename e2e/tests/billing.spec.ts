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

  test("is reachable from the settings navigation", async ({ signedIn }) => {
    await signedIn.goto("/settings/general");

    await signedIn.getByRole("link", { name: "Billing" }).click();

    await expect(signedIn).toHaveURL(/\/settings\/billing$/);
    await expect(signedIn.getByRole("heading", { name: "Billing" })).toBeVisible();
  });
});
