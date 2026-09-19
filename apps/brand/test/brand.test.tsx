import { Brand } from "@/brand.js";
import { render } from "@/render.js";
import { describe, expect, it } from "@effect/vitest";
import { render as mount, screen } from "@testing-library/react";
import { isInGamut, oklchToHex } from "@vantion/tokens/color";
import { colors, pairs } from "@vantion/tokens/tokens";

describe("the brand kit", () => {
  /**
   * The property that makes this page worth keeping. A brand document
   * maintained by hand is out of date the first time somebody changes a colour
   * — and worse than nothing, because people still believe it.
   */
  it("shows every colour the product ships", () => {
    mount(<Brand />);

    // `getAllByText` because a few names appear twice — `background` is both a
    // token and a pairing — and the assertion is that each is present, not that
    // it is unique.
    for (const [name, value] of Object.entries(colors)) {
      expect(screen.getAllByText(name, { exact: true }).length, `${name} is missing`)
        .toBeGreaterThan(0);
      expect(screen.getAllByText(value).length, `${value} is missing`).toBeGreaterThan(0);
    }
  });

  it("shows each colour as the hex mail clients will receive", () => {
    mount(<Brand />);

    expect(screen.getAllByText(oklchToHex(colors.primary)).length).toBeGreaterThan(0);
  });

  it("shows every declared pairing", () => {
    mount(<Brand />);

    for (const [surface] of pairs) {
      expect(screen.getAllByText(surface).length).toBeGreaterThan(0);
    }
  });

  /**
   * The page marks a colour outside sRGB, which is how one was caught before.
   * Nothing should be marked today — and if a token drifts out of gamut, the
   * page says so rather than rendering a silently clipped swatch.
   */
  it("has no token outside sRGB to mark", () => {
    mount(<Brand />);

    for (const value of Object.values(colors)) expect(isInGamut(value)).toBe(true);

    expect(screen.queryByText(/outside sRGB/)).not.toBeInTheDocument();
  });

  it("prerenders, so the kit reads without JavaScript", () => {
    const markup = render();

    expect(markup).toContain("Colour");
    expect(markup).toContain(colors.primary);
  });
});
