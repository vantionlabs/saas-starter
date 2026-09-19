import { expect, test } from "../fixtures.js";

test.describe("two-factor", () => {
  test("is offered, and off until somebody turns it on", async ({ signedIn }) => {
    await signedIn.goto("/settings/security");

    await expect(signedIn.getByRole("heading", { name: "Two-factor authentication" }))
      .toBeVisible();
    await expect(signedIn.getByText("Off")).toBeVisible();
    await expect(signedIn.getByRole("button", { name: "Set up" })).toBeVisible();
  });

  test("is reachable from the settings navigation", async ({ signedIn }) => {
    await signedIn.goto("/settings/general");
    await signedIn.getByRole("link", { name: "Security" }).click();

    await expect(signedIn).toHaveURL(/\/settings\/security$/);
  });

  /**
   * Asking for the password again is the point: enabling or disabling a second
   * factor from a session somebody else has stolen would be a way to lock the
   * owner out rather than a way to protect them.
   */
  test("asks for the password before changing how the account signs in", async ({ signedIn }) => {
    await signedIn.goto("/settings/security");
    await signedIn.getByRole("button", { name: "Set up" }).click();

    await expect(signedIn.getByLabel("Password")).toBeVisible();
    await expect(signedIn.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  /**
   * The page a sign-in lands on when the account has a second factor. It exists
   * whether or not anybody has enrolled, because the alternative — a client
   * redirecting somewhere that does not exist — is a sign-in that silently
   * stops.
   */
  test("has a page for the second step, with a way in when the phone is gone", async ({ page }) => {
    await page.goto("/auth/two-factor");

    await expect(page.getByText("One more step").first()).toBeVisible();
    await expect(page.getByLabel("Code")).toBeVisible();

    await page.getByRole("button", { name: /backup code/ }).click();
    await expect(page.getByLabel("Backup code")).toBeVisible();
  });
});
