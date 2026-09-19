import { expect, interactUntil, test } from "../fixtures.js";

test.describe("the assistant", () => {
  test("uses a tool to answer a question about the organization's data", async ({ signedIn }) => {
    await signedIn.goto("/assistant");

    await expect(signedIn.getByRole("heading", { name: "Assistant" })).toBeVisible();

    await signedIn.getByLabel("Message the assistant").fill("list my contacts");
    await signedIn.getByRole("button", { name: "Send", exact: true }).click();

    // The tool that ran is named on screen, so what the assistant did is
    // visible rather than implied by its answer.
    await expect(signedIn.getByText("ListContacts")).toBeVisible();
  });

  /**
   * The gate, from the outside. The assistant proposes a write, the card names
   * the arguments, nothing exists until somebody agrees, and then it does.
   */
  test("asks before it writes, and only writes once approved", async ({ signedIn }) => {
    await signedIn.goto("/assistant");

    await signedIn.getByLabel("Message the assistant").fill("add contact grace@navy.test");
    await signedIn.getByRole("button", { name: "Send", exact: true }).click();

    await expect(signedIn.getByText("Approve this action?")).toBeVisible();
    // The card names the call and its arguments, which is what a person is
    // agreeing to — not a paraphrase of it.
    await expect(signedIn.getByText(/CreateContact — email: grace@navy\.test/)).toBeVisible();

    // Nothing yet: the proposal is not the act.
    await signedIn.goto("/contacts");
    await expect(signedIn.getByRole("cell", { name: "grace@navy.test" })).toHaveCount(0);

    await signedIn.goBack();

    await interactUntil(
      () => signedIn.getByRole("button", { name: "Approve" }).click(),
      () => expect(signedIn.getByText("Approved")).toBeVisible(),
    );

    await signedIn.goto("/contacts");
    await expect(signedIn.getByRole("cell", { name: "grace@navy.test" })).toBeVisible();
  });

  test("declining leaves nothing behind", async ({ signedIn }) => {
    await signedIn.goto("/assistant");

    await signedIn.getByLabel("Message the assistant").fill("add contact nope@navy.test");
    await signedIn.getByRole("button", { name: "Send", exact: true }).click();

    await expect(signedIn.getByText("Approve this action?")).toBeVisible();

    await interactUntil(
      () => signedIn.getByRole("button", { name: "Decline" }).click(),
      () => expect(signedIn.getByText("Declined")).toBeVisible(),
    );

    await signedIn.goto("/contacts");
    await expect(signedIn.getByRole("cell", { name: "nope@navy.test" })).toHaveCount(0);
  });
});
