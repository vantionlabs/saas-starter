import { describe, expect, it } from "@effect/vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..");

const sources: Record<string, { readonly ref: string; readonly catalogPin: string; }> = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts", "vendor-sources.json"), "utf8"),
);

/**
 * The catalog is `workspaces.catalog` in the root manifest, which is where bun
 * keeps it. It used to be parsed out of `package.json` by regex; JSON is
 * the better half of that trade, since a pin is now read rather than matched.
 */
const catalogVersion = (name: string): string | undefined => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    readonly workspaces?: { readonly catalog?: Record<string, string>; };
  };

  return manifest.workspaces?.catalog?.[name]?.replace(/^[\^~]/, "");
};

/**
 * The precedence rule in `AGENTS.md` says the vendored source outranks
 * everything, including an agent's own recall. That is only true while the
 * vendored copy *is* the installed version — and it was not: both sources were
 * pinned to `main`, where the package version still reads as the last release
 * while the source has already moved past it.
 *
 * The result is the exact failure the rule exists to prevent. Writing this
 * repository's MCP server against `repos/effect` produced calls to
 * `McpProtocol.v2025_11_25` and a `description` option, neither of which exists
 * in rc.109. The compiler caught it; a runtime API would not have been.
 */
describe("vendored sources", () => {
  it("pins each ref to the installed version, never to a branch", () => {
    for (const [name, source] of Object.entries(sources)) {
      const version = catalogVersion(source.catalogPin);

      expect(version, `${source.catalogPin} is not in the catalog`).toBeDefined();
      expect(
        source.ref,
        `${name} is vendored from "${source.ref}", which is not the installed ${version}`,
      ).toContain(version!);
    }
  });

  it("vendors a copy whose package version matches the pin", () => {
    const effect = JSON.parse(
      fs.readFileSync(path.join(ROOT, "repos/effect/packages/effect/package.json"), "utf8"),
    ) as { readonly version: string; };

    /**
     * Necessary but nowhere near sufficient, which is the point of the test
     * above. This field only changes when a release is cut, so a copy taken
     * from `main` the day after rc.109 passes this and is still wrong.
     */
    expect(effect.version).toBe(catalogVersion("effect"));
  });
});
