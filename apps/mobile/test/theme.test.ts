import { nativeColors, nativeFonts, nativeRadius } from "@/theme.js";
import { describe, expect, it } from "@effect/vitest";
import { colors } from "@vantion/tokens/tokens";

/**
 * React Native's style engine does not parse `oklch`, and neither does a mail
 * client — which is why the tokens live in TypeScript and why this is the third
 * consumer of the same conversion rather than a second palette.
 */
describe("the native theme", () => {
  it("carries every token the product has", () => {
    for (const name of Object.keys(colors)) {
      expect(nativeColors[name as keyof typeof colors], `${name} is missing`).toBeDefined();
    }
  });

  it("converts every colour to a hex a phone can read", () => {
    for (const [name, value] of Object.entries(nativeColors)) {
      expect(value, `${name} is not hex`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  /**
   * The failure this prevents is silent: an `oklch(...)` string reaches a
   * `backgroundColor`, React Native cannot parse it, and the view renders
   * transparent with no warning anywhere.
   */
  it("leaves no oklch behind", () => {
    for (const value of Object.values(nativeColors)) expect(value).not.toContain("oklch");
  });

  it("turns the radius into points, because rem means nothing on a phone", () => {
    expect(nativeRadius).toBe(6);
    expect(Number.isInteger(nativeRadius)).toBe(true);
  });

  it("names one font family rather than a CSS stack", () => {
    expect(nativeFonts.sans).not.toContain(",");
    expect(nativeFonts.mono).not.toContain(",");
  });
});
