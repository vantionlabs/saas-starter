import { expect, PASSWORD, signOutViaApi, signUpViaApi, test, uniqueEmail } from "../fixtures.js";

test.describe("sign up", () => {
  test("creates an account through the form and lands on the dashboard", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // The promise of the sign-up page is that there is no orgless state to land
    // in: a personal organization exists by the time the dashboard renders.
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
