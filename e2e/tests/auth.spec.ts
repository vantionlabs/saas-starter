import {
  completeOnboarding,
  expect,
  PASSWORD,
  signOutViaApi,
  signUpViaApi,
  test,
  uniqueEmail,
} from "../fixtures.js";

test.describe("sign up", () => {
  test("creates an account through the form and lands in the product", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    /**
     * A brand-new account lands on the wizard, not the dashboard, because its
     * organization has not been set up — which is the promise of the sign-up
     * page working rather than failing: the organization exists by the time
     * anything renders, and what is missing is only the name for it.
     */
    await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible();

    await completeOnboarding(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("reports a password the schema rejects without a round trip", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await page.getByLabel("Email").fill(uniqueEmail("weak"));
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/auth\/sign-up/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeHidden();
  });

  test("refuses an address that already exists", async ({ page }) => {
    const email = uniqueEmail("dupe");
    await signUpViaApi(page, email);
    await signOutViaApi(page);

    await page.goto("/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up/);
  });
});

test.describe("sign in", () => {
  test("signs an existing user back in", async ({ page }) => {
    const email = uniqueEmail("signin");
    await signUpViaApi(page, email);
    await signOutViaApi(page);

    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    /**
     * Signed up through the API, so this account has never seen the wizard and
     * a sign-in lands there. Waiting on it is also what says the sign-in has
     * actually completed — `completeOnboarding` navigates, and navigating
     * while the form is still submitting lands back on this page.
     */
    await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible();

    await completeOnboarding(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("refuses a wrong password and stays put", async ({ page }) => {
    const email = uniqueEmail("wrongpw");
    await signUpViaApi(page, email);
    await signOutViaApi(page);

    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe("protected routes", () => {
  /**
   * The point of resolving the session in `beforeLoad` is that a protected route
   * never renders before it knows: there is no flash of the app shell on the way
   * to the sign-in page. Asserting the heading was never visible is what
   * distinguishes that from a redirect that happens after a paint.
   */
  test("send a signed-out visitor to sign-in", async ({ page }) => {
    await page.goto("/contacts");

    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeHidden();
  });

  test("stay reachable once signed in", async ({ signedIn }) => {
    await signedIn.goto("/contacts");
    await expect(signedIn.getByRole("heading", { name: "Contacts" })).toBeVisible();
  });
});

test.describe("invitations", () => {
  /**
   * The invitation email links here, and a link to a page that does not exist is
   * worse than no email at all — which is what this nearly shipped as.
   *
   * Signed out is the ordinary path, not the error: somebody is invited
   * precisely because they do not have an account yet.
   */
  test("the emailed link lands somewhere, even signed out", async ({ page }) => {
    await page.goto("/auth/accept-invitation/inv_does_not_exist");

    // `getByText`, not `getByRole("heading")`: shadcn's `CardTitle` renders a
    // div, so the auth cards have no heading role. Those primitives are
    // generated and not ours to redesign, so the test matches what is there.
    await expect(page.getByText("You have been invited")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create an account" })).toBeVisible();
  });
});
