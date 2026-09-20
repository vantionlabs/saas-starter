import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENTS_DIR,
  LOCK_FILE,
  readAgentLock,
  readAgents,
  readLock,
  readSkills,
  SKILLS_DIR,
} from "../Skills.js";

const ROOT = path.join(import.meta.dirname, "..", "..");

const skills = readSkills(ROOT);
const lock = readLock(ROOT);
const agents = readAgents(ROOT);
const agentLock = readAgentLock(ROOT);

/**
 * The agent layer is three surfaces over one directory, and nothing but a test keeps
 * them one. `.claude/skills` is a symlink, `.cursor/rules` and `.codex/SKILLS.md` are
 * generated, and each of those can rot silently — a stale Cursor rule keeps being loaded
 * and says nothing about being stale.
 */
describe("the agent layer", () => {
  /**
   * A skill nobody declared is a skill nobody reviewed the licence of. The marketing
   * skills are Apache-2.0 and impeccable is too, which is an obligation rather than a
   * courtesy — `NOTICE` exists because of it.
   */
  it("locks every skill that is present", () => {
    expect(skills.map((s) => s.name).filter((name) => lock[name] === undefined)).toEqual([]);
  });

  it("has no lock entry without a skill behind it", () => {
    const present = new Set(skills.map((s) => s.name));

    expect(Object.keys(lock).filter((name) => !present.has(name))).toEqual([]);
  });

  /** Vendored means somebody else's licence, and a file we can point at. */
  it("names a licence and its file for everything vendored", () => {
    for (const [name, entry] of Object.entries(lock)) {
      if (entry.origin !== "vendored") continue;

      expect(entry.license, `${name} has no licence`).toBeTruthy();
      expect(entry.url, `${name} has no upstream`).toBeTruthy();
      expect(
        fs.existsSync(path.join(ROOT, entry.licenseFile ?? "")),
        `${name}: ${entry.licenseFile} is not there`,
      ).toBe(true);
    }
  });

  /**
   * The description is what an agent decides relevance from, so an empty one is a skill
   * that never loads — present, committed, and invisible.
   */
  it("gives every skill a description an agent can route on", () => {
    for (const skill of skills) {
      expect(skill.description.length, `${skill.name} has no description`).toBeGreaterThan(40);
    }
  });

  /**
   * `.claude/skills` is a **symlink** to `.agents/skills`, not a copy. A copy is the
   * failure this whole layout exists to avoid: two directories of prose about the same
   * repository, one of which is quietly older.
   */
  it("points .claude/skills at the one directory", () => {
    const link = path.join(ROOT, ".claude", "skills");

    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(link)).toBe(fs.realpathSync(path.join(ROOT, SKILLS_DIR)));
  });

  /**
   * The generated views, checked by running the generator rather than by reimplementing
   * it — the same trick `packages/tokens` uses for its stylesheet. Its failure prints the
   * files to regenerate.
   */
  it("keeps .cursor and .codex current with the skills", () => {
    const run = () =>
      execFileSync("bun", [path.join(ROOT, "tooling", "agents.ts"), "--check"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: "pipe",
      });

    expect(run, "run `bun run agents`").not.toThrow();
  });

  /**
   * Agents get the same treatment as skills, because they carry the same obligation:
   * four of them are impeccable's, Apache-2.0, and a vendored file nobody declared is a
   * licence nobody reviewed.
   */
  it("locks every agent that is present", () => {
    expect(agents.map((a) => a.name).filter((name) => agentLock[name] === undefined))
      .toEqual([]);
  });

  it("has no agent lock entry without a file behind it", () => {
    const present = new Set(agents.map((a) => a.name));

    expect(Object.keys(agentLock).filter((name) => !present.has(name))).toEqual([]);
  });

  it("names a licence and its file for every vendored agent", () => {
    for (const [name, entry] of Object.entries(agentLock)) {
      if (entry.origin !== "vendored") continue;

      expect(entry.license, `${name} has no licence`).toBeTruthy();
      expect(
        fs.existsSync(path.join(ROOT, entry.licenseFile ?? "")),
        `${name}: ${entry.licenseFile} is not there`,
      ).toBe(true);
    }
  });

  /**
   * An agent's description is what decides whether it is ever launched. A thin one is a
   * subagent that sits there costing nothing and doing nothing.
   */
  it("gives every agent a description worth routing on", () => {
    for (const agent of agents) {
      expect(agent.description.length, `${agent.name} has no description`).toBeGreaterThan(60);
    }
  });

  /** `.claude/agents` is the same symlink arrangement as the skills, for the same reason. */
  it("points .claude/agents at the one directory", () => {
    const link = path.join(ROOT, ".claude", "agents");

    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(link)).toBe(fs.realpathSync(path.join(ROOT, AGENTS_DIR)));
  });

  /** The lock is JSON somebody reads in a diff, so it has to parse and be sorted-ish. */
  it("is a lock file a reviewer can read", () => {
    const raw = fs.readFileSync(path.join(ROOT, LOCK_FILE), "utf8");

    expect(() => JSON.parse(raw)).not.toThrow();
    for (const [name, entry] of Object.entries(lock)) {
      expect(entry.why, `${name} has no reason`).toBeTruthy();
    }
  });
});
