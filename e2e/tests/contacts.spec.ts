import type { Page } from "@playwright/test";
import { expect, test, uniqueEmail } from "../fixtures.js";

const addContact = async (page: Page, fullName: string, email: string) => {
  await page.getByLabel("Name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Add contact" }).click();
};

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

  test("the submit button stays disabled until both fields are filled", async ({ signedIn }) => {
    await signedIn.goto("/contacts");
    const submit = signedIn.getByRole("button", { name: "Add contact" });

    await expect(submit).toBeDisabled();

    await signedIn.getByLabel("Name").fill("Only A Name");
    await expect(submit).toBeDisabled();

    await signedIn.getByLabel("Email").fill(uniqueEmail("enabled"));
    await expect(submit).toBeEnabled();
  });
});
