import { resolveWithin, signPath, verifyPath } from "@/LocalStore.js";
import { describe, expect, it } from "@effect/vitest";

const secret = "test-secret";

describe("signed paths", () => {
  it("accepts a link it signed itself", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;

    expect(
      verifyPath({
        secret,
        key: "org_a/file_1",
        expiresAt,
        signature: signPath({ secret, key: "org_a/file_1", expiresAt }),
      }),
    ).toBe("ok");
  });

  /**
   * The property the whole scheme exists for: a link to one object cannot be
   * edited into a link to another. Without the key inside the HMAC, anybody
   * holding one download URL would hold all of them.
   */
  it("refuses a link whose key was changed", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const signature = signPath({ secret, key: "org_a/file_1", expiresAt });

    expect(verifyPath({ secret, key: "org_b/file_9", expiresAt, signature })).toBe("Mismatch");
  });

  /** And the expiry is inside it too, so it cannot simply be pushed forward. */
  it("refuses a link whose expiry was extended", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const signature = signPath({ secret, key: "org_a/file_1", expiresAt });

    expect(
      verifyPath({ secret, key: "org_a/file_1", expiresAt: expiresAt + 86_400, signature }),
    ).toBe("Mismatch");
  });

  it("refuses a link that has run out", () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 1;

    expect(
      verifyPath({
        secret,
        key: "org_a/file_1",
        expiresAt,
        signature: signPath({ secret, key: "org_a/file_1", expiresAt }),
      }),
    ).toBe("Expired");
  });

  /**
   * The response's content type is signed too, and this is why: a caller who
   * could change it could have their own upload served as `text/html`, which is
   * a cross-site scripting hole with an upload form in front of it.
   */
  it("refuses a link whose content type was changed", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const signature = signPath({
      secret,
      key: "org_a/file_1",
      expiresAt,
      contentType: "text/plain",
    });

    expect(
      verifyPath({
        secret,
        key: "org_a/file_1",
        expiresAt,
        signature,
        contentType: "text/html",
      }),
    ).toBe("Mismatch");

    expect(
      verifyPath({ secret, key: "org_a/file_1", expiresAt, signature, contentType: "text/plain" }),
    ).toBe("ok");
  });

  it("refuses a signature of the wrong length rather than throwing", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;

    expect(verifyPath({ secret, key: "org_a/file_1", expiresAt, signature: "short" })).toBe(
      "Mismatch",
    );
  });
});

describe("resolving a key to a path", () => {
  it("keeps an ordinary key inside the directory", () => {
    expect(resolveWithin("/uploads", "org_a/file_1")).toBe("/uploads/org_a/file_1");
  });

  /**
   * Keys are generated rather than accepted, so this should be unreachable —
   * which is exactly why it is worth a test. The difference between a storage
   * bug and an arbitrary file write is this one check.
   */
  it("refuses one that climbs out of it", () => {
    expect(resolveWithin("/uploads", "../../etc/passwd")).toBeUndefined();
    expect(resolveWithin("/uploads", "org_a/../../etc/passwd")).toBeUndefined();
  });

  it("refuses an absolute key", () => {
    expect(resolveWithin("/uploads", "/etc/passwd")).toBeUndefined();
  });
});
