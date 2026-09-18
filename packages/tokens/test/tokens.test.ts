import { isInGamut, oklchToHex, oklchToRgb } from "@/color.js";
import { renderCss } from "@/css.js";
import { colors, pairs, radius } from "@/tokens.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "tokens.css"), "utf8");

describe("tokens", () => {
  /**
   * The committed stylesheet is generated, and Tailwind reads it at build time.
   * Without this the two drift silently and the web app renders yesterday's
   * palette while every other consumer has today's.
   */
  it("the committed stylesheet matches the source", () => {
    expect(CSS).toBe(renderCss());
  });

  it("every colour reaches the stylesheet, as a value and as a utility", () => {
    for (const name of Object.keys(colors)) {
      expect(CSS, name).toContain(`--${name}: ${colors[name as keyof typeof colors]};`);
      expect(CSS, name).toContain(`--color-${name}: var(--${name});`);
    }

    expect(CSS).toContain(`--radius: ${radius};`);
  });

  /**
   * A surface with no declared foreground is a surface nothing can safely put
   * text on, and the Figma generator has no variable to pair it with.
   */
  it("every foreground belongs to a surface", () => {
    const paired = new Set(pairs.flat());

    for (const name of Object.keys(colors)) {
      if (name.endsWith("-foreground")) {
        expect(paired.has(name as never), `${name} is not paired with a surface`).toBe(true);
      }
    }
  });

  it("names a real colour on both sides of every pair", () => {
    for (const [surface, foreground] of pairs) {
      expect(colors[surface], surface).toBeTypeOf("string");
      expect(colors[foreground], foreground).toBeTypeOf("string");
    }
  });

  /** oklch throughout, so the Figma and NativeWind generators need one parser. */
  it("states every colour in one colour space", () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(value, name).toMatch(/^oklch\(/);
    }
  });

  /**
   * A colour outside sRGB is clipped by the browser without a word, so what
   * renders is not what is written here — and the Figma variable, converted from
   * the same string, disagrees with both. `success` was this: chroma 0.2 at that
   * hue and lightness clipped to a different green entirely.
   */
  it("keeps every colour inside sRGB", () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(isInGamut(value), `${name} (${value}) is outside sRGB and will be clipped`).toBe(true);
    }
  });
});

describe("oklch conversion", () => {
  it("agrees with the endpoints everyone knows", () => {
    expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
  });

  it("returns channels Figma can hold", () => {
    const { r, g, b } = oklchToRgb(colors.primary);

    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it("refuses a colour it cannot read rather than guessing", () => {
    expect(() => oklchToHex("#ff0000")).toThrow(/not an oklch colour/);
    expect(() => oklchToHex("rgb(1 2 3)")).toThrow(/not an oklch colour/);
  });
});
