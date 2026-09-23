import { apiUrl } from "@/ApiUrl.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

afterEach(() => {
  process.env["EXPO_PUBLIC_API_URL"] = original["EXPO_PUBLIC_API_URL"];
  process.env["VITE_AUTH_BASE_URL"] = original["VITE_AUTH_BASE_URL"];
  vi.unstubAllGlobals();
});

/**
 * One expression, two bundlers.
 *
 * Vite substitutes `import.meta.env.VITE_*` and leaves `process.env` alone;
 * Metro inlines `process.env.EXPO_PUBLIC_*` and has no `import.meta.env` at
 * all. Reading both names is what lets this package be shared without a shim
 * or a `define` that has to be kept in step in two places.
 */
describe("the API address", () => {
  it("prefers Expo's name, because only a native build sets it", () => {
    process.env["EXPO_PUBLIC_API_URL"] = "https://api.example";
    process.env["VITE_AUTH_BASE_URL"] = "https://web.example";

    expect(apiUrl()).toBe("https://api.example");
  });

  it("falls back to the web's", () => {
    delete process.env["EXPO_PUBLIC_API_URL"];
    process.env["VITE_AUTH_BASE_URL"] = "https://web.example";

    expect(apiUrl()).toBe("https://web.example");
  });

  /**
   * The web app's normal case: it serves the API's browser-facing routes from
   * its own origin, so the page's origin is the answer and nothing had to be
   * compiled into the bundle to say so.
   */
  it("uses the page's own origin in a browser when neither is set", () => {
    delete process.env["EXPO_PUBLIC_API_URL"];
    delete process.env["VITE_AUTH_BASE_URL"];
    vi.stubGlobal("location", { origin: "https://app-pr-42.up.railway.app" });

    expect(apiUrl()).toBe("https://app-pr-42.up.railway.app");
  });

  it("runs on localhost outside a browser when neither is set, so a fresh clone works", () => {
    delete process.env["EXPO_PUBLIC_API_URL"];
    delete process.env["VITE_AUTH_BASE_URL"];
    vi.stubGlobal("location", undefined);

    expect(apiUrl()).toBe("http://localhost:3000");
  });

  /**
   * A trailing slash would produce `https://api.example//rpc`, which some
   * proxies answer and others redirect — and a redirect drops the body of a
   * POST.
   */
  it("never leaves a trailing slash for the path to double", () => {
    process.env["EXPO_PUBLIC_API_URL"] = "https://api.example/";

    expect(apiUrl()).toBe("https://api.example");
  });

  it("ignores an empty value rather than building a relative URL", () => {
    process.env["EXPO_PUBLIC_API_URL"] = "";
    process.env["VITE_AUTH_BASE_URL"] = "https://web.example";

    expect(apiUrl()).toBe("https://web.example");
  });
});
