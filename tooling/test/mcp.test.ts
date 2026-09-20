import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");

const config = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8")) as {
  readonly mcpServers: Record<string, {
    readonly command: string;
    readonly args?: ReadonlyArray<string>;
    readonly env?: Record<string, string>;
  }>;
};

const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
const doc = fs.readFileSync(path.join(ROOT, "docs", "mcp-servers.md"), "utf8");

/** `${FOO}` in a value is a variable the client interpolates from the environment. */
const interpolated = (): ReadonlyArray<string> =>
  Object.values(config.mcpServers).flatMap((server) =>
    [...Object.values(server.env ?? {}), ...(server.args ?? [])]
      .flatMap((value) => [...value.matchAll(/\$\{([A-Z0-9_]+)\}/g)])
      .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
  );

/**
 * `.mcp.json` is inherited by every repository generated from this template, and it is
 * the kind of file that rots quietly: a server nobody starts, pointed at a package that
 * was deprecated a year ago, reading a variable nobody documented.
 *
 * Two of the three servers this file started with were deprecated when somebody finally
 * looked — and `RAILWAY_API_TOKEN` had never reached `.env.example`, so the one thing a
 * reader needed to make it work was the one thing not written down.
 */
describe("the project's MCP servers", () => {
  it("documents every variable it interpolates", () => {
    const missing = [...new Set(interpolated())]
      .filter((name) => !new RegExp(`^${name}=`, "m").test(envExample));

    expect(missing, "add these to .env.example").toEqual([]);
  });

  /**
   * A server nobody explains is a server nobody can decide to remove. The doc also
   * carries what is deliberately *absent*, which is the half that stops the same
   * rejected idea being re-proposed every six months.
   */
  it("explains every server it declares", () => {
    const undocumented = Object.keys(config.mcpServers).filter((name) => !doc.includes(name));

    expect(undocumented, "name these in docs/mcp-servers.md").toEqual([]);
  });

  /**
   * bun is the runtime here, so `npx` in this file is a second package manager resolving
   * a second copy of everything — and on a machine with no Node, a server that will not
   * start at all.
   */
  it("starts its servers with bun", () => {
    for (const [name, server] of Object.entries(config.mcpServers)) {
      expect(["bun", "bunx"], `${name} uses ${server.command}`).toContain(server.command);
    }
  });

  /**
   * The one server that is this repository's own runs **from source**. An editor pointed
   * at `build/bundle/main.js` answers from whatever was built last, which is exactly the
   * code somebody is in the middle of changing.
   */
  it("runs its own toolkit from source, not from a stale bundle", () => {
    const vantion = config.mcpServers["vantion"];

    expect(vantion).toBeDefined();
    expect(vantion?.args?.join(" ")).toContain("apps/mcp/src/Main.ts");
    expect(vantion?.args?.join(" ")).not.toContain("build/bundle");
  });
});
