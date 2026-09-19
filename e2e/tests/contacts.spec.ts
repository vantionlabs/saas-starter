import { addContact, expect, test, uniqueEmail } from "../fixtures.js";

test.describe("contacts", () => {
  test("start empty, with an empty state that names what is missing", async ({ signedIn }) => {
    await signedIn.goto("/contacts");

    await expect(signedIn.getByText("No contacts yet")).toBeVisible();
    await expect(signedIn.getByRole("table")).toBeHidden();
  });

  test("a created contact appears in the table", async ({ signedIn }) => {
    const email = uniqueEmail("contact");
    await signedIn.goto("/contacts");

    await addContact(signedIn, "Ada Lovelace", email);

    const row = signedIn.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText("Ada Lovelace")).toBeVisible();
    await expect(signedIn.getByText("No contacts yet")).toBeHidden();
  });

  /**
   * The assertion that SSR is real, rather than fast.
   *
   * Everything else in this file passes just as well when the list is fetched
   * after hydration — the table fills in either way and Playwright waits. This
   * asks the server for the document and looks in the markup, so it fails the
   * day somebody moves the read back into the browser.
   */
  test("the list is in the server-rendered document", async ({ signedIn }) => {
    const email = uniqueEmail("ssr");
    await signedIn.goto("/contacts");
    await addContact(signedIn, "Server Rendered", email);
    await expect(signedIn.getByRole("row").filter({ hasText: email })).toBeVisible();

    // The page's own request context, so it carries the session cookie.
    const response = await signedIn.request.get("/contacts");
    const html = await response.text();

    expect(html).toContain(email);
    expect(html).toContain("Server Rendered");
  });

  test("a deleted contact leaves the table", async ({ signedIn }) => {
    const email = uniqueEmail("doomed");
    await signedIn.goto("/contacts");
    await addContact(signedIn, "Grace Hopper", email);

    const row = signedIn.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Delete" }).click();

    await expect(row).toBeHidden();
    await expect(signedIn.getByText("No contacts yet")).toBeVisible();
  });

  test("survive a reload, because they were actually persisted", async ({ signedIn }) => {
    const email = uniqueEmail("persisted");
    await signedIn.goto("/contacts");
    await addContact(signedIn, "Alan Turing", email);

    await expect(signedIn.getByRole("row").filter({ hasText: email })).toBeVisible();

    await signedIn.reload();

    await expect(signedIn.getByRole("row").filter({ hasText: email })).toBeVisible();
  });

  test("submitting an incomplete form says which field is missing", async ({ signedIn }) => {
    await signedIn.goto("/contacts");

    /**
     * effect-form does not render its fields during SSR, so waiting for the
     * input is waiting for hydration. Nothing here needs a retry or a sleep:
     * the control does not exist until it works.
     */
    await signedIn.getByLabel("Name").fill("Only A Name");
    await signedIn.getByRole("button", { name: "Add contact" }).click();

    // Per field, from the schema, rather than one sentence about the form.
    await expect(signedIn.getByText("Enter your email address.")).toBeVisible();
    await expect(signedIn.getByRole("table")).toBeHidden();
  });
});
