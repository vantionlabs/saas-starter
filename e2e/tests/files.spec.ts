import { expect, interactUntil, test } from "../fixtures.js";

test.describe("files", () => {
  /**
   * The whole round trip, which no unit test can stand in for: the browser asks
   * for a ticket, PUTs the bytes at the URL it was given, the server confirms
   * the object is really there, and the file appears in the list.
   *
   * It runs against the local store, because that is what a deployment with no
   * S3 credentials uses and therefore what a fresh clone runs.
   */
  test("upload a file, download it, and delete it", async ({ signedIn }) => {
    await signedIn.goto("/files");

    await expect(signedIn.getByRole("heading", { name: "Files" })).toBeVisible();
    await expect(signedIn.getByText("No files yet")).toBeVisible();

    /**
     * Wait for the control before using it. `setInputFiles` fires a `change`
     * event, and until React has attached there is nothing listening: the file
     * lands on the input and no upload starts. The page is server-rendered, so
     * it looks ready well before it is — and the Upload button is the one thing
     * in the markup that says otherwise, since it stays disabled until both
     * hydration and the caller's permissions have arrived.
     */
    await expect(signedIn.getByRole("button", { name: "Upload" })).toBeEnabled();

    await expect(signedIn.getByRole("button", { name: "Upload" })).toBeEnabled();

    await signedIn.getByLabel("File to upload").setInputFiles({
      name: "report.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("the quarterly numbers"),
    });

    await expect(signedIn.getByRole("cell", { name: "report.txt", exact: true })).toBeVisible();
    // The size shown is storage's answer, not the one the browser claimed.
    await expect(signedIn.getByRole("cell", { name: "21 B" })).toBeVisible();

    // The download link is signed and short-lived, so it is followed directly
    // rather than through a new tab — what matters is that the bytes come back.
    const [download] = await Promise.all([
      signedIn.context().waitForEvent("page"),
      signedIn.getByRole("button", { name: "Download report.txt" }).click(),
    ]);

    // The tab opens blank and navigates, so wait for the URL rather than
    // reading it the instant the page event fires.
    await download.waitForURL(/\/files\/.*signature=/);
    await expect(download.getByText("the quarterly numbers")).toBeVisible();

    await interactUntil(
      () => signedIn.getByRole("button", { name: "Delete report.txt" }).click(),
      () => expect(signedIn.getByText("No files yet")).toBeVisible(),
    );
  });

  test("a link with a tampered signature is refused", async ({ signedIn, request }) => {
    await signedIn.goto("/files");

    await expect(signedIn.getByRole("button", { name: "Upload" })).toBeEnabled();

    await signedIn.getByLabel("File to upload").setInputFiles({
      name: "private.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not yours"),
    });

    await expect(signedIn.getByRole("cell", { name: "private.txt", exact: true })).toBeVisible();

    const [download] = await Promise.all([
      signedIn.context().waitForEvent("page"),
      signedIn.getByRole("button", { name: "Download private.txt" }).click(),
    ]);

    await download.waitForURL(/\/files\/.*signature=/);

    const url = new URL(download.url());
    url.searchParams.set("signature", "0".repeat(64));

    // No session is sent, and none would help: the signature is the whole of
    // the authorisation here, which is what lets a link be handed to an `<img>`.
    const response = await request.get(url.toString());
    expect(response.status()).toBe(403);
  });
});
