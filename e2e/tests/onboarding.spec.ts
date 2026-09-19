import { expect, signUpViaApi, test, uniqueEmail } from "../fixtures.js";

/**
 * The one suite that does **not** use the `signedIn` fixture, because that
 * fixture's job is to get past the wizard and this one's is the wizard.
 */
test.describe("onboarding", () => {
  test("sends a brand-new workspace to set itself up", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard"));
    await page.goto("/");

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible();
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
  });

  /**
   * The gate applies to every page below it, not only the dashboard — a link
   * from an email into a settings screen must not walk around it.
   */
  test("gates the rest of the application, not just the landing page", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard-deep"));
    await page.goto("/contacts");

    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("advances to inviting once the workspace is named", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard-name"));
    await page.goto("/onboarding");

    await page.getByLabel("Workspace name").fill("Northwind Traders");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
  });

  /**
   * The property that makes it a wizard rather than a form: the step is on the
   * organization, so a reload comes back to where somebody left off. Held in
   * React state this would silently restart, and the only symptom would be
   * somebody being asked to name their workspace twice.
   */
  test("comes back to the step it left off at", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard-resume"));
    await page.goto("/onboarding");

    await page.getByLabel("Workspace name").fill("Northwind Traders");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();
  });

  /**
   * The name is a real write, not wizard state — the shell reads it, so this
   * is also what proves the step and the rename landed together rather than
   * the step advancing on its own.
   */
  test("keeps the name it was given", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard-kept"));
    await page.goto("/onboarding");

    await page.getByLabel("Workspace name").fill("Northwind Traders");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();

    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.goto("/settings/general");

    await expect(page.getByLabel("Name")).toHaveValue("Northwind Traders");
  });

  /**
   * Skippable from the first step, and finished for good once skipped. A gate
   * that bounced somebody back would be one they could only escape by not
   * using the product.
   */
  test("can be skipped, and does not ask again", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard-skip"));
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/onboarding");

    // Finished already, so the wizard has nothing left to ask.
    await expect(page).toHaveURL(/\/$/);
  });

  /**
   * The one thing the application shell would have offered and cannot, because
   * the shell is behind the redirect this page exists to satisfy. Without it,
   * somebody who signed in as the wrong person has no way out but clearing a
   * cookie.
   */
  test("lets somebody sign out from inside it", async ({ page }) => {
    await signUpViaApi(page, uniqueEmail("onboard-out"));
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });
});
