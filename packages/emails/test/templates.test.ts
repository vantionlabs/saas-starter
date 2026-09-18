import { renderEmail } from "@/Render.js";
import { EmailOtp } from "@/templates/EmailOtp.js";
import { Invitation } from "@/templates/Invitation.js";
import { MagicLink } from "@/templates/MagicLink.js";
import { ResetPassword } from "@/templates/ResetPassword.js";
import { VerifyEmail } from "@/templates/VerifyEmail.js";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const product = "Acme";
const url = "https://acme.test/auth/verify?token=abc123";

const render = <P>(template: Parameters<typeof renderEmail<P>>[0], props: P) =>
  Effect.runPromise(renderEmail(template, props));

describe("transactional emails", () => {
  /**
   * Every one renders both parts, always.
   *
   * A message with no text part is one that some clients show as an empty body
   * and some filters score as spam — and it is what makes a magic link
   * followable out of a terminal when `RESEND_API_KEY` is unset and the mailer
   * logs instead of sending.
   */
  it.each(
    [
      ["MagicLink", MagicLink, { url, product }],
      ["ResetPassword", ResetPassword, { url, product }],
      ["VerifyEmail", VerifyEmail, { url, product }],
    ] as const,
  )("%s renders html and text", async (_name, template, props) => {
    const rendered = await render(template, props);

    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.html).toContain("<html");
    expect(rendered.text.trim().length).toBeGreaterThan(0);
    expect(rendered.html).not.toContain(rendered.text);
  });

  it.each(
    [
      ["MagicLink", MagicLink],
      ["ResetPassword", ResetPassword],
      ["VerifyEmail", VerifyEmail],
    ] as const,
  )("%s carries its link in both parts", async (_name, template) => {
    const rendered = await render(template, { url, product });

    expect(rendered.html).toContain(url);
    // The one that matters for a fresh clone: the link has to be followable
    // from the server log, which only ever shows the text.
    expect(rendered.text).toContain(url);
  });

  it("names the product in the magic link subject", async () => {
    expect((await render(MagicLink, { url, product })).subject).toBe("Your Acme sign-in link");
  });

  /**
   * The code goes in the subject, which is most of why people prefer codes to
   * links: it is readable from a notification without opening anything.
   */
  it("puts the one-time code in the subject and the body", async () => {
    const rendered = await render(EmailOtp, { code: "417293", product });

    expect(rendered.subject).toBe("417293 is your Acme code");
    expect(rendered.html).toContain("417293");
    expect(rendered.text).toContain("417293");
  });

  /**
   * Named after the organization, not the product: that is what the reader
   * recognises, having usually never heard of the product.
   */
  it("names the organization in the invitation subject", async () => {
    const rendered = await render(Invitation, {
      url,
      organization: "Northwind",
      role: "admin",
      product,
    });

    expect(rendered.subject).toBe("You have been invited to Northwind");
    expect(rendered.html).toContain("admin");
    expect(rendered.text).toContain(url);
  });

  it("escapes what it is given rather than trusting it", async () => {
    const rendered = await render(MagicLink, {
      url,
      product: "<script>alert(1)</script>",
    });

    expect(rendered.html).not.toContain("<script>alert(1)</script>");
  });
});
