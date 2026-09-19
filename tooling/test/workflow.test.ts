import { describe, expect, it } from "@effect/vitest";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..");
const WORKFLOW = path.join(ROOT, "docs", "workflow");

const read = (...segments: ReadonlyArray<string>): string =>
  fs.readFileSync(path.join(ROOT, ...segments), "utf8");

const spec = read("docs", "workflow", "SPEC.md.example");

/** `## 5. The slices` → `{ number: 5, title: "The slices" }`, in file order. */
const sections = [...spec.matchAll(/^## (\d+)\. (.+)$/gm)].map((match) => ({
  number: Number(match[1]),
  title: match[2],
}));

/**
 * The spec is the handover between the phase that decides what to build and the
 * phase that builds it, so the two ends have to agree about the artefact without
 * anything checking that they do. These tests are that check.
 *
 * The failure they exist for is quiet: a heading renamed here, a command still
 * telling an agent to read a section that no longer has that name, and a build
 * phase that improvises the scope instead — which is the exact failure the spec
 * was introduced to prevent.
 */
describe("the workflow's artefacts", () => {
  /**
   * `/product-build` and `03-build.md` both cite sections of the spec by number.
   * That coupling is worth having — "§5" is shorter than a quotation and does
   * not rot when a sentence is reworded — but it is only safe while something
   * fails when the numbering moves.
   */
  it("keeps the section numbers the commands cite", () => {
    expect(sections.find((section) => section.number === 5)?.title).toBe("The slices");
    expect(sections.find((section) => section.number === 7)?.title).toBe("Not in this, and why");
  });

  it("numbers its sections consecutively from one", () => {
    expect(sections.map((section) => section.number)).toEqual(
      sections.map((_, index) => index + 1),
    );
  });

  /**
   * Two of the slice table's columns are binding rather than descriptive:
   * `Tenant-owned` is what commits a slice to a row-level security policy and a
   * tenancy test, and `Shown by` is what has to exist before a row may be called
   * landed. An agent looks for them by name.
   */
  it("gives the slice table the columns the build phase reads", () => {
    const header = /^\| #\s+\|(.+)\|$/m.exec(spec)?.[1];

    expect(header, "the slice table has no header row").toBeDefined();
    expect(header!.split("|").map((column) => column.trim())).toEqual([
      "Slice",
      "Module",
      "Tenant-owned",
      "Shown by",
      "State",
    ]);
  });

  it("names every state the build phase sets", () => {
    for (const state of ["todo", "building", "landed"]) {
      expect(spec, `the template never mentions \`${state}\``).toContain(`\`${state}\``);
    }

    /**
     * Only the two the command transitions between. `todo` is the state a row
     * is written in, which the template declares and the command never has to
     * name.
     */
    const build = read(".claude", "commands", "product-build.md");

    expect(build).toContain("`building`");
    expect(build).toContain("`landed`");
  });

  /**
   * The distinction the documents draw, made real. `STATE.md` describes one
   * product's progress and is ignored; the spec is that product's scope and is
   * committed. Backwards, a client's spec is written and then silently never
   * committed, which nobody notices until the repository is handed over.
   */
  it("ignores STATE.md and commits SPEC.md", () => {
    const ignored = (file: string): boolean => {
      try {
        execFileSync("git", ["check-ignore", "-q", path.join("docs", "workflow", file)], {
          cwd: ROOT,
          stdio: "ignore",
        });

        return true;
      } catch {
        return false;
      }
    };

    expect(ignored("STATE.md")).toBe(true);
    expect(ignored("SPEC.md")).toBe(false);
  });

  /**
   * A phase document that links to a file which has been renamed reads exactly
   * like one that does not — `01-discovery.md` survived a rename this way and
   * was cited in three places for several slices.
   */
  it("resolves every relative link between the phase documents", () => {
    for (const file of fs.readdirSync(WORKFLOW).filter((name) => name.endsWith(".md"))) {
      const contents = fs.readFileSync(path.join(WORKFLOW, file), "utf8");

      const targets = [...contents.matchAll(/]\((?!https?:)([^)#]+)(?:#[^)]*)?\)/g)]
        .flatMap((match) => match[1] ?? []);

      for (const target of targets) {
        expect(
          fs.existsSync(path.join(WORKFLOW, target)),
          `${file} links to ${target}, which does not exist`,
        ).toBe(true);
      }
    }
  });

  /**
   * The phase documents and the commands both point into `knowledge/`, and a
   * pointer to a file that has been renamed reads exactly like one that has
   * not. `01-discovery.md` proved that inside `docs/workflow/`; these paths
   * leave it, so the link check above cannot see them.
   */
  it("resolves every knowledge path the workflow and its commands cite", () => {
    const sources = [
      ...fs.readdirSync(WORKFLOW).filter((name) => name.endsWith(".md")).map((name) =>
        path.join(WORKFLOW, name)
      ),
      ...fs.readdirSync(path.join(ROOT, ".claude", "commands")).map((name) =>
        path.join(ROOT, ".claude", "commands", name)
      ),
      path.join(ROOT, "AGENTS.md"),
    ];

    const cited = new Set<string>();

    for (const source of sources) {
      for (const [, cite] of fs.readFileSync(source, "utf8").matchAll(/`(knowledge\/[^`]+)`/g)) {
        if (cite !== undefined) cited.add(cite);
      }
    }

    expect(cited.size, "nothing cites knowledge/ at all").toBeGreaterThan(0);

    for (const cite of cited) {
      expect(fs.existsSync(path.join(ROOT, cite)), `${cite} does not exist`).toBe(true);
    }
  });

  /** Four phases, four documents, four commands, and nothing orphaned. */
  it("has a command for every phase the overview lists", () => {
    const overview = read("docs", "workflow", "00-overview.md");
    const commands = new Set(
      [...overview.matchAll(/`\/(product-[a-z]+)`/g)].map((match) => match[1]),
    );

    expect(commands).toEqual(
      new Set(["product-discover", "product-prototype", "product-build", "product-ship"]),
    );

    for (const command of commands) {
      expect(
        fs.existsSync(path.join(ROOT, ".claude", "commands", `${command}.md`)),
        `the overview names /${command}, which has no command file`,
      ).toBe(true);
    }
  });
});
