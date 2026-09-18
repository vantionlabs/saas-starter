import { COLLECTION, figmaVariables, figmaVariableScript, MODE } from "@/figma.js";
import { colors, pairs, radius } from "@/tokens.js";
import { describe, expect, it } from "vitest";

describe("figmaVariables", () => {
  it("carries every colour across", () => {
    const { colors: variables } = figmaVariables();

    expect(variables).toHaveLength(Object.keys(colors).length);
    for (const token of Object.keys(colors)) {
      expect(variables.find((v) => v.token === token), token).toBeDefined();
    }
  });

  /** `/` is what groups variables in Figma's sidebar; without it they are a flat list of twenty. */
  it("namespaces them so Figma groups them", () => {
    for (const variable of figmaVariables().colors) {
      expect(variable.name).toBe(`color/${variable.token}`);
    }
  });

  it("converts to channels Figma can hold", () => {
    for (const { name, value } of figmaVariables().colors) {
      for (const channel of [value.r, value.g, value.b]) {
        expect(channel, name).toBeGreaterThanOrEqual(0);
        expect(channel, name).toBeLessThanOrEqual(1);
      }
    }
  });

  /**
   * The pairing is why the collection is usable rather than just present: a
   * designer picking a surface can be shown the one foreground that belongs on it.
   */
  it("records which surface each foreground belongs to", () => {
    const variables = figmaVariables().colors;

    for (const [surface, foreground] of pairs) {
      expect(variables.find((v) => v.token === foreground)?.foregroundOf, foreground)
        .toBe(surface);
    }

    expect(variables.find((v) => v.token === "background")?.foregroundOf).toBeUndefined();
  });

  it("states the radius in the units Figma measures in", () => {
    expect(radius).toBe("0.375rem");
    expect(figmaVariables().numbers).toEqual([{ name: "radius/base", value: 6 }]);
  });

  /** One mode, because there is one palette. A second would have to be invented. */
  it("declares a single mode", () => {
    expect(figmaVariables().mode).toBe(MODE);
    expect(figmaVariables().collection).toBe(COLLECTION);
  });
});

describe("figmaVariableScript", () => {
  it("writes every colour and the radius", () => {
    const script = figmaVariableScript();

    for (const token of Object.keys(colors)) {
      expect(script, token).toContain(`"color/${token}"`);
    }
    expect(script).toContain("\"radius/base\": 6");
  });

  /**
   * A design system is synced repeatedly, not created once, so the script has to
   * find what is already there instead of adding a second copy of it.
   */
  it("updates rather than duplicates on a second run", () => {
    const script = figmaVariableScript();

    expect(script).toContain("getLocalVariableCollectionsAsync");
    expect(script).toContain("getLocalVariablesAsync");
    expect(script).toContain("byName.get(name) ??");
  });

  it("says where it came from, so nobody edits the output", () => {
    expect(figmaVariableScript()).toContain("Do not edit");
  });
});
