import { expect, test } from "../fixtures.js";

/**
 * The account is not the organization's, and these tests are mostly about that
 * boundary holding: a person reaches their own password and sessions without
 * any permission inside a workspace.
 */
test.describe("account", () => {
  test("is reachable from the shell and shows the signed-in address", async ({ signedIn }) => {
    await signedIn.goto("/");
    await signedIn.getByRole("link", { name: /@/ }).click();

    await expect(signedIn).toHaveURL(/\/account$/);
    await expect(signedIn.getByRole("heading", { name: "Profile" })).toBeVisible();
  });

  test("offers a name, a password and sessions, and nothing of the organization's", async ({ signedIn }) => {
    await signedIn.goto("/account");

    await expect(signedIn.getByRole("heading", { name: "Password" })).toBeVisible();
    await expect(signedIn.getByLabel("Display name")).toBeVisible();
    // The org's settings are a different area entirely.
    await expect(signedIn.getByRole("link", { name: "Billing" })).toBeHidden();
  });

  /**
   * Server-rendered, like every other read. The token is dropped at the
   * boundary, so it must not appear in the markup the server sends — that is
   * the assertion worth having, because a leak here would be invisible.
   */
  test("lists sessions in the server-rendered markup, without any token", async ({ signedIn }) => {
    await signedIn.goto("/account/sessions");
    await expect(signedIn.getByRole("heading", { name: "Sessions" })).toBeVisible();

    const response = await signedIn.request.get("/account/sessions");
    const html = await response.text();
    const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");

    expect(markup).toContain("Sessions");
    // Whatever else is in there, not a session token.
    expect(html).not.toMatch(/"token":"[A-Za-z0-9]/);
  });

  test("two-factor moved here, out of the organization settings", async ({ signedIn }) => {
    await signedIn.goto("/account/security");

    await expect(signedIn.getByRole("heading", { name: "Two-factor authentication" }))
      .toBeVisible();
  });
});
