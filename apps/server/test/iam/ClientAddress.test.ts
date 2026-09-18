import { clientAddress } from "@/iam/ClientAddress.js";
import { Option } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

/**
 * Only the three fields `clientAddress` reads. Constructing a real
 * `HttpServerRequest` would drag a server in to test a pure function.
 */
const request = (options: {
  readonly forwardedFor?: string;
  readonly remoteAddress?: string;
}) =>
  ({
    headers: options.forwardedFor === undefined
      ? {}
      : { "x-forwarded-for": options.forwardedFor },
    remoteAddress: options.remoteAddress === undefined
      ? Option.none()
      : Option.some(options.remoteAddress),
    url: "/api/auth/sign-in/email",
  }) as unknown as HttpServerRequest.HttpServerRequest;

describe("clientAddress", () => {
  describe("with no proxy trusted", () => {
    it("uses the socket address", () => {
      expect(clientAddress(request({ remoteAddress: "203.0.113.7" }), 0)).toBe("203.0.113.7");
    });

    /**
     * The header is not merely outranked, it is not read at all. Anything else
     * would let a direct caller pick its own rate-limit bucket.
     */
    it("ignores the forwarded header entirely", () => {
      const spoofed = request({ forwardedFor: "1.2.3.4", remoteAddress: "203.0.113.7" });

      expect(clientAddress(spoofed, 0)).toBe("203.0.113.7");
    });

    it("falls back to a shared bucket when there is no socket address", () => {
      expect(clientAddress(request({}), 0)).toBe("unknown");
    });
  });

  describe("with one proxy trusted", () => {
    it("takes the address the proxy appended", () => {
      const forwarded = request({ forwardedFor: "203.0.113.7", remoteAddress: "10.0.0.1" });

      expect(clientAddress(forwarded, 1)).toBe("203.0.113.7");
    });

    /**
     * The whole point of counting from the right.
     *
     * A client that sends its own `X-Forwarded-For` has that value preserved on
     * the left when the proxy appends what it actually saw. Reading the leftmost
     * entry — which this code used to do — hands every caller an unlimited
     * supply of rate-limit buckets, and the limit protecting a twenty-bit OTP
     * stops being a limit.
     */
    it("is not fooled by a client that sends its own header", () => {
      const spoofed = request({
        forwardedFor: "1.2.3.4, 203.0.113.7",
        remoteAddress: "10.0.0.1",
      });

      expect(clientAddress(spoofed, 1)).toBe("203.0.113.7");
    });

    it("is not fooled by a long invented chain", () => {
      const spoofed = request({
        forwardedFor: "1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.7",
        remoteAddress: "10.0.0.1",
      });

      expect(clientAddress(spoofed, 1)).toBe("203.0.113.7");
    });

    it("tolerates the spacing real proxies produce", () => {
      const spaced = request({
        forwardedFor: " 1.2.3.4 ,   203.0.113.7  ",
        remoteAddress: "10.0.0.1",
      });

      expect(clientAddress(spaced, 1)).toBe("203.0.113.7");
    });

    /**
     * A request that reached a supposedly-proxied server with no header did not
     * come through the chain configured here, so the header proves nothing and
     * the socket address is the only evidence left.
     */
    it("falls back to the socket address when the header is absent", () => {
      expect(clientAddress(request({ remoteAddress: "10.0.0.1" }), 1)).toBe("10.0.0.1");
    });

    it("falls back when the header is present but empty", () => {
      const empty = request({ forwardedFor: "  ,  ", remoteAddress: "10.0.0.1" });

      expect(clientAddress(empty, 1)).toBe("10.0.0.1");
    });
  });

  describe("with two proxies trusted", () => {
    it("counts back past both of them", () => {
      const forwarded = request({
        forwardedFor: "203.0.113.7, 10.0.0.5",
        remoteAddress: "10.0.0.1",
      });

      expect(clientAddress(forwarded, 2)).toBe("203.0.113.7");
    });

    it("is not fooled by a client that sends its own header", () => {
      const spoofed = request({
        forwardedFor: "1.2.3.4, 203.0.113.7, 10.0.0.5",
        remoteAddress: "10.0.0.1",
      });

      expect(clientAddress(spoofed, 2)).toBe("203.0.113.7");
    });

    /**
     * Fewer entries than hops means the request did not traverse the chain this
     * server was told to expect. Trusting what is there would let a caller
     * shorten the header to move the index onto a value it controls.
     */
    it("refuses a header shorter than the configured chain", () => {
      const truncated = request({ forwardedFor: "1.2.3.4", remoteAddress: "10.0.0.1" });

      expect(clientAddress(truncated, 2)).toBe("10.0.0.1");
    });
  });

  /**
   * A negative count is a misconfiguration, and the safe reading of one is the
   * same as zero rather than an index counted off the end of the list.
   */
  it("treats a negative trusted-proxy count as trusting none", () => {
    const spoofed = request({ forwardedFor: "1.2.3.4", remoteAddress: "203.0.113.7" });

    expect(clientAddress(spoofed, -1)).toBe("203.0.113.7");
  });
});
