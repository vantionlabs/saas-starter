import { sign, TOLERANCE_SECONDS, verify } from "@/Signature.js";
import { describe, expect, it } from "vitest";

const secret = "whsec_test_0123456789";
const body = JSON.stringify({ type: "contact.created", data: { id: "c1" } });
const at = new Date("2026-09-18T12:00:00Z");

describe("webhook signatures", () => {
  it("verifies what it signed", () => {
    expect(verify({ secret, body, header: sign({ secret, body, at }), now: at })).toBeUndefined();
  });

  it("refuses a body that changed in flight", () => {
    const header = sign({ secret, body, at });

    expect(verify({ secret, body: `${body} `, header, now: at })).toBe("Mismatch");
  });

  it("refuses a different secret", () => {
    const header = sign({ secret, body, at });

    expect(verify({ secret: "whsec_someone_else", body, header, now: at })).toBe("Mismatch");
  });

  /**
   * The timestamp is inside the HMAC, so moving it invalidates the signature
   * rather than extending its life.
   */
  it("refuses a replayed delivery once it is stale", () => {
    const header = sign({ secret, body, at });
    const later = new Date(at.getTime() + (TOLERANCE_SECONDS + 1) * 1000);

    expect(verify({ secret, body, header, now: later })).toBe("Expired");
  });

  it("allows a receiver's clock to be a little out, in either direction", () => {
    const header = sign({ secret, body, at });

    for (const skew of [-TOLERANCE_SECONDS + 1, TOLERANCE_SECONDS - 1]) {
      const now = new Date(at.getTime() + skew * 1000);
      expect(verify({ secret, body, header, now }), String(skew)).toBeUndefined();
    }
  });

  it("refuses a forged timestamp", () => {
    const header = sign({ secret, body, at });
    const forged = header.replace(/^t=\d+/, `t=${Math.floor(at.getTime() / 1000) + 10}`);

    expect(verify({ secret, body, header: forged, now: at })).toBe("Mismatch");
  });

  it("refuses a header it cannot read rather than guessing", () => {
    for (const header of ["", "nonsense", "t=abc,v1=deadbeef", "t=123", "t=123,v1=zzzz"]) {
      expect(verify({ secret, body, header, now: at }), header).toBe("Malformed");
    }
  });

  it("states the scheme it is using, so a receiver can be written against it", () => {
    expect(sign({ secret, body, at })).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });
});
