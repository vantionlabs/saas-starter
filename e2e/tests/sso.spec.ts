import { expect, test } from "../fixtures.js";

test.describe("single sign-on", () => {
  /**
   * A fresh organization is on the free plan, and single sign-on is not on it.
   *
   * What matters is that the page says so plainly rather than offering a button
   * that fails when pressed — the same bargain the billing page makes when
   * Stripe is unconfigured. The refusal exists on the server either way; this
   * asserts somebody is told before they try.
   */
  test("tells a free organization that its plan does not carry it", async ({ signedIn }) => {
    await signedIn.goto("/settings/sso");

    await expect(signedIn.getByRole("heading", { name: "Single sign-on" })).toBeVisible();
    await expect(signedIn.getByText("Not on this plan")).toBeVisible();
    await expect(signedIn.getByRole("button", { name: "Add a provider" })).toHaveCount(0);
  });

  test("is reachable from the settings navigation", async ({ signedIn }) => {
    await signedIn.goto("/settings/general");

    await signedIn.getByRole("link", { name: "Single sign-on" }).click();

    await expect(signedIn).toHaveURL(/\/settings\/sso$/);
    await expect(signedIn.getByRole("heading", { name: "Single sign-on" })).toBeVisible();
  });

  /**
   * Sign-in asks for an address, never for a list of providers.
   *
   * A picker would be the obvious alternative and it is the wrong one: on a
   * multi-tenant product it shows every customer who the other customers are.
   */
  test("offers sign-in by email address, not by picking an organization", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.getByRole("link", { name: "Sign in with your company" }).click();

    await expect(page).toHaveURL(/\/auth\/sso$/);
    // `getByText`, not `getByRole("heading")`: shadcn's `CardTitle` renders a
    // `div`, so the auth cards carry no heading role. Noted elsewhere in this
    // suite for the same reason.
    await expect(page.getByText("Sign in with your company").first()).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
  });

  /**
   * An address with no provider behind it is refused, and refused the same way
   * whether or not the domain exists here — otherwise this form is a way to ask
   * the product which companies are customers.
   */
  test("refuses an address with no provider without saying why not", async ({ page }) => {
    await page.goto("/auth/sso");

    await page.getByLabel("Work email").fill("someone@no-such-provider.example");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/could not find a provider/)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sso$/);
  });
});
