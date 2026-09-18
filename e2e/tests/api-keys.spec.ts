import { API_URL, expect, interactUntil, test } from "../fixtures.js";

test.describe("api keys", () => {
  test("a new key authenticates against the public API, and revoking it stops working", async ({ signedIn, request }) => {
    await signedIn.goto("/settings/api-keys");

    await interactUntil(
      () => signedIn.getByRole("button", { name: "New key" }).click(),
      () => expect(signedIn.getByRole("heading", { name: "New API key" })).toBeVisible(),
    );

    await signedIn.getByLabel("Name").fill("e2e key");
    await signedIn.getByRole("button", { name: "Create key" }).click();

    await expect(signedIn.getByRole("heading", { name: "Copy your key" })).toBeVisible();
    const secret = (await signedIn.locator("code").first().innerText()).trim();
    expect(secret).not.toBe("");

    await signedIn.getByRole("button", { name: "Done" }).click();

    /**
     * A request context of its own, with no session cookie: the point of a key
     * is that it works without one, and `signedIn.request` would have proven
     * nothing but that the cookie still works.
     */
    const authorised = await request.get(`${API_URL}/api/v1/contacts`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(authorised.status()).toBe(200);

    await signedIn.getByRole("row").filter({ hasText: "e2e key" })
      .getByRole("button", { name: "Revoke" }).click();

    await expect(signedIn.getByRole("row").filter({ hasText: "e2e key" })).toHaveCount(0);

    const revoked = await request.get(`${API_URL}/api/v1/contacts`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(revoked.status()).toBe(401);
  });

  test("the public API refuses a request with no key", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/contacts`);
    expect(response.status()).toBe(401);
  });

  test("the public API refuses a key that was never issued", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/contacts`, {
      headers: { authorization: "Bearer vantion_live_0000000000000000000000000000000000000000" },
    });
    expect(response.status()).toBe(401);
  });

  test("the OpenAPI document describes the contacts endpoints", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/openapi.json`);
    expect(response.status()).toBe(200);

    const document = await response.json();
    expect(document.paths).toHaveProperty("/api/v1/contacts");
  });
});
