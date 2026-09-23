#!/usr/bin/env bun
/**
 * Writes the per-tool views of `.agents/skills`.
 *
 *   bun run agents          write them
 *   bun run agents --check  fail if what is on disk is not what this would write
 *
 * `--check` is what `tooling/test/skills.test.ts` and CI use, for the reason
 * `packages/tokens` generates its stylesheet the same way: a generated file that is
 * committed is one a reader can trust, and a test is what stops it going stale.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AGENTS_DIR,
  codexSkills,
  cursorRule,
  readAgents,
  readSkills,
  SKILLS_DIR,
} from "./Skills.js";

const ROOT = path.join(import.meta.dirname, "..");

/** Every file this writes, as path → contents. */
const generate = () => {
  const skills = readSkills(ROOT);
  const agents = readAgents(ROOT);
  const files: Record<string, string> = {
    [path.join(".codex", "SKILLS.md")]: codexSkills(skills, agents),
  };

  for (const skill of skills) {
    files[path.join(".cursor", "rules", `${skill.name}.mdc`)] = cursorRule(skill);
  }

  return files;
};

class Stale extends Error {
  readonly _tag = "Stale";
  constructor(readonly paths: ReadonlyArray<string>) {
    super(`out of date: ${paths.join(", ")}`);
  }
}

const command = Command.make(
  "agents",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDescription("Fail instead of writing when the generated files are stale."),
      Flag.withDefault(false),
    ),
  },
  Effect.fnUntraced(function*({ check }) {
    const files = generate();

    if (check) {
      const stale = Object.entries(files).flatMap(([file, contents]) => {
        const at = path.join(ROOT, file);
        const current = fs.existsSync(at) ? fs.readFileSync(at, "utf8") : undefined;

        return current === contents ? [] : [file];
      });

      /**
       * A file nothing generates any more is stale too — a skill removed from
       * `.agents/skills` leaves its rule behind, and Cursor would keep loading it.
       */
      const rules = path.join(ROOT, ".cursor", "rules");
      const orphans = fs.existsSync(rules)
        ? fs.readdirSync(rules)
          .filter((f) => f.endsWith(".mdc"))
          .map((f) => path.join(".cursor", "rules", f))
          .filter((f) => !(f in files))
        : [];

      if (stale.length > 0 || orphans.length > 0) {
        return yield* Effect.fail(new Stale([...stale, ...orphans]));
      }

      yield* Effect.log(`${Object.keys(files).length} generated files are current`);
      return;
    }

    for (const [file, contents] of Object.entries(files)) {
      const at = path.join(ROOT, file);
      fs.mkdirSync(path.dirname(at), { recursive: true });
      fs.writeFileSync(at, contents);
    }

    /** Remove what no longer has a skill behind it, rather than leaving it to rot. */
    const rules = path.join(ROOT, ".cursor", "rules");
    if (fs.existsSync(rules)) {
      for (const f of fs.readdirSync(rules)) {
        const rel = path.join(".cursor", "rules", f);
        if (f.endsWith(".mdc") && !(rel in files)) fs.rmSync(path.join(rules, f));
      }
    }

    yield* Effect.log(
      `wrote ${Object.keys(files).length} files from ${SKILLS_DIR} and ${AGENTS_DIR}`,
    );
  }),
);

BunRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer)),
);
