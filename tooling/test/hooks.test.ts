import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");
const HOOKS = path.join(ROOT, ".claude", "hooks");

/** Runs a hook the way Claude Code does: JSON on stdin, meaning in the exit code. */
const fire = (hook: string, input: unknown) => {
  try {
    const stdout = execFileSync("node", [path.join(HOOKS, hook)], {
      input: JSON.stringify(input),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string; };
    return {
      code: failure.status ?? 1,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? ""),
    };
  }
};

const temp: Array<string> = [];

const sourceFile = (name: string, contents: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-"));
  temp.push(dir);
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
};

afterEach(() => {
  for (const dir of temp.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("guard-bash", () => {
  it("refuses the commands that are expensive to undo", () => {
    for (
      const command of [
        "git push --force origin main",
        "git push -f",
        "git commit --no-verify -m wip",
        "rm -rf repos/effect",
        "rm -rf /",
      ]
    ) {
      expect(fire("guard-bash.mjs", { tool_input: { command } }).code, command).toBe(2);
    }
  });

  /**
   * The refusals have to be narrow enough to live with. A guard that also blocks
   * the safe spelling of the same thing gets removed rather than tightened.
   */
  it("allows the safe spellings and ordinary work", () => {
    for (
      const command of [
        "git push --force-with-lease",
        "git push origin main",
        "git commit -m 'a change'",
        "pnpm test",
        "rm -rf apps/server/build",
        "cat repos/effect/packages/effect/src/Config.ts",
      ]
    ) {
      expect(fire("guard-bash.mjs", { tool_input: { command } }).code, command).toBe(0);
    }
  });

  it("says why, so the refusal is actionable", () => {
    const { stderr } = fire("guard-bash.mjs", { tool_input: { command: "git push --force" } });

    expect(stderr).toContain("--force-with-lease");
  });

  it("ignores a tool call with no command", () => {
    expect(fire("guard-bash.mjs", { tool_input: {} }).code).toBe(0);
  });
});

describe("check-rules", () => {
  it("reports the violations it can decide", () => {
    const file = sourceFile(
      "Bad.ts",
      [
        `import { Schema } from "effect";`,
        `const payload = Schema.Unknown;`,
        `const id = raw as ContactId;`,
        `export const wrap = (x: number) => Effect.gen(function*() { return x; });`,
      ].join("\n"),
    );

    const { code, stderr } = fire("check-rules.mjs", { tool_input: { file_path: file } });

    expect(code).toBe(2);
    expect(stderr).toContain("Schema.Unknown");
    expect(stderr).toContain("EntityId.make");
    expect(stderr).toContain("Effect.fnUntraced");
  });

  /** A rule quoted in a comment is documentation, not a violation. */
  it("does not fire on a comment that mentions a rule", () => {
    const file = sourceFile(
      "Commented.ts",
      "// Never use Schema.Unknown here.\nexport const a = 1;\n",
    );

    expect(fire("check-rules.mjs", { tool_input: { file_path: file } }).code).toBe(0);
  });

  it("rejects a barrel outright", () => {
    const file = sourceFile("index.ts", "export const a = 1;\n");

    expect(fire("check-rules.mjs", { tool_input: { file_path: file } }).stderr)
      .toContain("barrel");
  });

  it("ignores files it has no business checking", () => {
    const notes = sourceFile("notes.md", "Schema.Unknown\n");

    expect(fire("check-rules.mjs", { tool_input: { file_path: notes } }).code).toBe(0);
    expect(fire("check-rules.mjs", { tool_input: { file_path: "/nope/gone.ts" } }).code).toBe(0);
  });

  /**
   * The bar for adding a rule: it holds across the repository today. A check
   * that fires on existing code is one somebody disables within the hour.
   */
  it("is silent on every source file in this repository", () => {
    const listed = execFileSync("git", ["ls-files", "apps", "packages"], {
      cwd: ROOT,
      encoding: "utf8",
    });

    const sources = listed.split("\n")
      .filter((file) => /\.tsx?$/.test(file) && !file.startsWith("repos/"));

    expect(sources.length).toBeGreaterThan(50);

    const firing = sources.filter((file) =>
      fire("check-rules.mjs", { tool_input: { file_path: path.join(ROOT, file) } }).code !== 0
    );

    expect(firing).toEqual([]);
  });
});

describe("session-context", () => {
  it("names the pinned Effect version and where its source is", () => {
    const { code, stdout } = fire("session-context.mjs", {});

    expect(code).toBe(0);
    expect(stdout).toContain("4.0.0-rc.109");
    expect(stdout).toContain("repos/effect");
  });
});
