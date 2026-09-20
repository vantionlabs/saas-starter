import { expect, test } from "../fixtures.js";

test.describe("directory sync", () => {
  /**
   * The free plan does not carry provisioning in the example split, so this is
   * the state a fresh clone shows — and it must explain itself rather than
   * offer a button that is refused.
   */
  test("says the plan does not include it", async ({ signedIn }) => {
    await signedIn.goto("/settings/scim");

    await expect(signedIn.getByRole("heading", { name: "Directory sync" })).toBeVisible();
    await expect(signedIn.getByText("Not on this plan")).toBeVisible();
    await expect(signedIn.getByRole("button", { name: "New connection" })).toHaveCount(0);
  });

  test("is reachable from the settings navigation, beside single sign-on", async ({ signedIn }) => {
    await signedIn.goto("/settings/sso");

    await signedIn.getByRole("link", { name: "Directory sync" }).click();

    await expect(signedIn).toHaveURL(/\/settings\/scim$/);
  });

  /** Rendered by the server, like every other read on these screens. */
  test("arrives with the document", async ({ signedIn }) => {
    await signedIn.goto("/settings/scim");

    const response = await signedIn.request.get("/settings/scim");
    const markup = (await response.text())
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    expect(markup).toContain("Directory sync");
    expect(markup).toContain("Not on this plan");
  });

  /**
   * The SCIM endpoints are on the API and speak their own error shape. This is
   * the one an identity provider hits first when its token is wrong, and it
   * must be a SCIM error rather than an HTML page or a silence.
   */
  test("refuses an unauthenticated provisioning request", async ({ request }) => {
    const response = await request.post("http://localhost:3100/api/auth/scim/v2/Users", {
      headers: { "content-type": "application/scim+json", origin: "http://localhost:5273" },
      data: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "x@y.test" },
    });

    expect(response.status()).toBe(401);
  });
});
