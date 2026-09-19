import { apiUrl } from "@/ApiUrl.js";
import { afterEach, describe, expect, it } from "vitest";

const original = { ...process.env };

afterEach(() => {
  process.env["EXPO_PUBLIC_API_URL"] = original["EXPO_PUBLIC_API_URL"];
  process.env["VITE_AUTH_BASE_URL"] = original["VITE_AUTH_BASE_URL"];
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

  it("runs on localhost when neither is set, so a fresh clone works", () => {
    delete process.env["EXPO_PUBLIC_API_URL"];
    delete process.env["VITE_AUTH_BASE_URL"];

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
