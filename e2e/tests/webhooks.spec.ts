import { expect, test } from "../fixtures.js";

test.describe("webhooks", () => {
  /**
   * The e2e organization is on the free plan, which does not include webhooks
   * in the example split — so this is the state most visitors see first, and
   * the one that must explain itself rather than offer a button that fails.
   */
  test("says the plan does not include them, and still shows the screen", async ({ signedIn }) => {
    await signedIn.goto("/settings/webhooks");

    await expect(signedIn.getByRole("heading", { name: "Webhooks" })).toBeVisible();
    await expect(signedIn.getByText("Not on this plan")).toBeVisible();

    /**
     * Reading is never gated on the plan — an organization that downgraded has
     * to be able to see why deliveries stopped — so the list and the attempts
     * are both rendered, empty.
     */
    await expect(signedIn.getByRole("heading", { name: "Recent deliveries" })).toBeVisible();
    await expect(signedIn.getByText("Nothing has been sent yet.")).toBeVisible();
    await expect(signedIn.getByRole("button", { name: "Add endpoint" })).toHaveCount(0);
  });

  test("is reachable from the settings navigation", async ({ signedIn }) => {
    await signedIn.goto("/settings/api-keys");

    await signedIn.getByRole("link", { name: "Webhooks" }).click();

    await expect(signedIn).toHaveURL(/\/settings\/webhooks$/);
    await expect(signedIn.getByRole("heading", { name: "Webhooks" })).toBeVisible();
  });

  /**
   * Rendered by the server, like every other read on these screens. Scripts and
   * React's `<!-- -->` text-node separators are stripped first, or the search
   * finds nothing in markup that is perfectly correct.
   */
  test("arrives with the document", async ({ signedIn }) => {
    await signedIn.goto("/settings/webhooks");

    const response = await signedIn.request.get("/settings/webhooks");
    const markup = (await response.text())
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    expect(markup).toContain("Recent deliveries");
    expect(markup).toContain("No endpoints yet");
  });

  /**
   * The endpoint count is the fourth meter, and it appears now that something
   * can move it — a row that could only ever read zero is not a measurement.
   */
  test("counts against the plan on the billing screen", async ({ signedIn }) => {
    await signedIn.goto("/settings/billing");

    await expect(signedIn.getByRole("progressbar", { name: "Webhook endpoints" }))
      .toHaveAttribute("aria-valuenow", "0");
  });
});
