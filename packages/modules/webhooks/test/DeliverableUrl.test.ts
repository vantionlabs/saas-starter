import { refuseUrl } from "@/DeliverableUrl.js";
import { EndpointFields } from "@/WebhooksRpc.js";
import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

const open = { allowLoopback: true };
const closed = { allowLoopback: false };

/**
 * The SSRF tests, and the most valuable file in this module.
 *
 * A webhook endpoint is a URL a customer chooses and a server of ours then
 * fetches. Everything below is an address somebody would supply on purpose to
 * make the delivery worker fetch something it should not — and every one of
 * them is a valid URL, which is why a schema alone does not cover this.
 */
describe("what may be delivered to", () => {
  it("accepts an ordinary https endpoint", () => {
    expect(refuseUrl("https://hooks.acme.com/vantion", closed)).toBeUndefined();
    expect(refuseUrl("https://acme.com:8443/hook?x=1", closed)).toBeUndefined();
  });

  /**
   * Plain HTTP is refused even though the delivery is signed: the signature
   * protects the body from being *changed*, not from being *read*, and these
   * events carry a tenant's own records.
   */
  it("refuses plain http", () => {
    expect(refuseUrl("http://hooks.acme.com/vantion", closed)).toBe("NotHttps");
  });

  it("refuses something that is not a URL at all", () => {
    expect(refuseUrl("hooks.acme.com", closed)).toBe("NotAUrl");
    expect(refuseUrl("", closed)).toBe("NotAUrl");
  });

  /**
   * The one that matters. `169.254.169.254` is the cloud metadata service on
   * AWS, GCP and Azure alike: an endpoint pointing there has the delivery
   * worker fetch the instance's own credentials, and the next endpoint
   * registered is where they get posted.
   */
  it("refuses the cloud metadata address", () => {
    expect(refuseUrl("https://169.254.169.254/latest/meta-data/", closed)).toBe("PrivateHost");
  });

  it.each([
    "https://10.0.0.5/hook",
    "https://192.168.1.1/hook",
    "https://172.16.0.1/hook",
    "https://172.31.255.255/hook",
    "https://0.0.0.0/hook",
    "https://[fd00::1]/hook",
    "https://[fe80::1]/hook",
  ])("refuses the private address %s", (url) => {
    expect(refuseUrl(url, closed)).toBe("PrivateHost");
  });

  /** Outside the private range, so not refused — `172.32.x` is public space. */
  it("does not over-reach on the 172 range", () => {
    expect(refuseUrl("https://172.32.0.1/hook", closed)).toBeUndefined();
    expect(refuseUrl("https://172.15.0.1/hook", closed)).toBeUndefined();
  });

  /**
   * Loopback is the deliberate exception, and it is a switch rather than a
   * rule: the first thing anybody does with this is point it at a receiver on
   * their own machine, and a starter that refuses that is one nobody can try.
   * A deployed instance has no business delivering to its own loopback, where
   * its own unauthenticated internal services listen.
   */
  it("allows localhost only where the deployment says so", () => {
    expect(refuseUrl("http://localhost:4000/hook", open)).toBeUndefined();
    expect(refuseUrl("http://127.0.0.1:4000/hook", open)).toBeUndefined();
    expect(refuseUrl("http://[::1]:4000/hook", open)).toBeUndefined();

    expect(refuseUrl("http://localhost:4000/hook", closed)).toBe("PrivateHost");
    expect(refuseUrl("https://127.0.0.1/hook", closed)).toBe("PrivateHost");
  });

  /**
   * Stated as a test so the limit is not something somebody has to infer: this
   * check runs on the string, before DNS. A hostname resolving into private
   * space passes here and is fetched anyway. Closing that needs egress rules on
   * the worker, which `docs/webhooks.md` says.
   */
  it("cannot see where a hostname resolves", () => {
    expect(refuseUrl("https://internal.acme.com/hook", closed)).toBeUndefined();
  });
});

/**
 * The rule reaches the contract, which is the half that matters at runtime.
 *
 * `EndpointFields.url` is what `RegisterEndpoint`'s payload is built from *and*
 * what the form validates with, so a refusal here is a refusal on both ends —
 * and the sentence somebody reads is the one declared beside the rule. Asserted
 * against the schema rather than through a procedure because that is where the
 * rule lives; a handler test would only be checking that the payload was
 * declared correctly.
 */
describe("the contract's URL field", () => {
  const decode = Schema.decodeUnknownResult(EndpointFields.url);

  const refusal = (value: string) => {
    const result = decode(value);

    return Result.isFailure(result) ? JSON.stringify(result.failure) : undefined;
  };

  it("accepts an ordinary https endpoint", () => {
    expect(Result.isSuccess(decode("https://hooks.acme.com/vantion"))).toBe(true);
  });

  it("refuses the cloud metadata address, in words somebody can act on", () => {
    expect(refusal("https://169.254.169.254/latest/meta-data/")).toContain("private network");
  });

  it("refuses plain http, and says why rather than just failing", () => {
    expect(refusal("http://hooks.acme.com/hook")).toContain("https://");
  });

  it("asks for a URL when the field is empty", () => {
    expect(refusal("")).toContain("Enter a URL.");
  });
});
