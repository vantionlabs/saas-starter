import { addContact, API_URL, expect, interactUntil, test } from "../fixtures.js";

test.describe("operations", () => {
  test("liveness and readiness answer", async ({ request }) => {
    const health = await request.get(`${API_URL}/health`);
    expect(health.status()).toBe(200);

    // Readiness is the one that talks to Postgres, so it is the one that proves
    // the stack under test is actually wired to a database.
    const ready = await request.get(`${API_URL}/ready`);
    expect(ready.status()).toBe(200);
  });
});

test.describe("transports", () => {
  /**
   * The websocket endpoint serves the same procedures as `/rpc`.
   *
   * This asserts the upgrade rather than a round trip: hand-rolling the RPC
   * envelope here would be testing a copy of the wire format instead of the
   * server. What it catches is the thing that actually breaks — the endpoint not
   * being mounted, which types cannot tell you.
   */
  test("accepts a websocket upgrade on /rpc/ws", async ({ page }) => {
    await page.goto("/");

    const opened = await page.evaluate(
      (url) =>
        new Promise<string>((resolve) => {
          const socket = new WebSocket(url);
          const settle = (outcome: string) => {
            socket.close();
            resolve(outcome);
          };

          socket.onopen = () => settle("open");
          socket.onerror = () => settle("error");
          setTimeout(() => settle("timeout"), 5000);
        }),
      `${API_URL.replace(/^http/, "ws")}/rpc/ws`,
    );

    expect(opened).toBe("open");
  });
});

test.describe("app shell", () => {
  test("navigates between sections by real links", async ({ signedIn }) => {
    await expect(signedIn.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // `getByRole("link")` rather than a button is the assertion: navigation that
    // middle-click and open-in-new-tab still work on is a stated house rule, and
    // a button here would pass a click test while breaking that.
    await signedIn.getByRole("link", { name: "Contacts" }).click();
    await expect(signedIn.getByRole("heading", { name: "Contacts" })).toBeVisible();
    await expect(signedIn).toHaveURL("/contacts");

    await signedIn.getByRole("link", { name: "Settings" }).click();
    await expect(signedIn).toHaveURL(/\/settings/);
  });

  test("shows a breadcrumb trail for the current route", async ({ signedIn }) => {
    await signedIn.goto("/contacts");
    await expect(signedIn.getByRole("navigation", { name: /breadcrumb/i })).toContainText(
      "Contacts",
    );
  });

  test("opens the command palette on its keyboard shortcut", async ({ signedIn }) => {
    const palette = signedIn.getByRole("dialog");

    // The shortcut is bound in an effect, so it does not exist until hydration.
    await interactUntil(
      () => signedIn.keyboard.press("ControlOrMeta+k"),
      () => expect(palette).toBeVisible(),
    );

    await signedIn.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  test("renders a not-found page for an unknown route", async ({ signedIn }) => {
    await signedIn.goto("/no-such-page");
    await expect(signedIn.getByText("That page does not exist.")).toBeVisible();
  });
});

test.describe("settings", () => {
  test("reaches every settings section", async ({ signedIn }) => {
    for (
      const [path, heading] of [
        ["/settings/general", /general/i],
        ["/settings/members", /members/i],
        ["/settings/roles", /roles/i],
        ["/settings/api-keys", /api keys/i],
        ["/settings/audit", /audit/i],
      ] as const
    ) {
      await signedIn.goto(path);
      await expect(signedIn.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("records the creation of a contact in the audit trail", async ({ signedIn }) => {
    await signedIn.goto("/contacts");
    await addContact(signedIn, "Audited Person", "audited@example.test");
    await expect(signedIn.getByRole("row").filter({ hasText: "audited@example.test" }))
      .toBeVisible();

    await signedIn.goto("/settings/audit");
    await expect(signedIn.getByRole("table")).toContainText(/contact/i);
  });
});
