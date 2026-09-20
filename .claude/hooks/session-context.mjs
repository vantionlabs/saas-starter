#!/usr/bin/env node
// Three facts that otherwise cost a session several turns to discover.
//
// SessionStart is one of the few events whose stdout Claude actually reads, so
// this prints rather than reports. It stays short: everything here is something
// an agent would otherwise assume wrongly.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { projectDir } from "./lib.mjs";

const root = projectDir();

/**
 * The catalog lives in the root `package.json` under `workspaces.catalog`,
 * which is where bun keeps it. pnpm's `pnpm-workspace.yaml` is gone.
 */
const effectVersion = () => {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return manifest.workspaces?.catalog?.effect ?? "unknown";
  } catch {
    return "unknown";
  }
};

const vendored = fs.existsSync(path.join(root, "repos", "effect", "packages"));

/**
 * `docker compose ps --quiet` exits 0 and prints nothing when the service is not
 * running, so the container id is the answer rather than the exit code.
 */
const postgres = () => {
  try {
    const id = execFileSync(
      "docker",
      ["compose", "ps", "--status", "running", "--quiet", "postgres"],
      { cwd: root, stdio: ["ignore", "pipe", "ignore"] },
    ).toString().trim();

    return id !== "";
  } catch {
    return false;
  }
};

const lines = [
  `Effect is pinned at ${effectVersion()} — a release candidate whose APIs moved recently.`,
  /**
   * The one thing a cold agent reliably gets wrong: it writes four hundred
   * lines of something Effect already has, because this repository uses about
   * twenty of its hundred and twenty modules and nothing in the tree hints at
   * the other hundred.
   */
  "This repository uses ~20 of Effect's ~120 modules. Before writing something that does not resemble the code already here — bounding concurrency, caching a decision, batching a lookup, a process that must survive a restart, a script with arguments — read `knowledge/rules/effect-reach-for.md`. It is keyed on the problem, not the module name.",
  vendored
    ? "Its source is vendored at `repos/effect`. Read the real signature there before using an API you have not already read this session; it outranks RULES.md, knowledge/ and your own recall, in that order."
    : "`repos/effect` is MISSING. Run `bun run vendor` — without it there is no authority for Effect APIs and recall is not one.",
];

/**
 * Product work outlives any context window, and two files carry it across one.
 *
 * The spec is what the work *is* — it is long, so this names it rather than
 * printing it; a session that is about to build must open it, because the slice
 * table is the input to that phase rather than a record of it.
 */
const spec = path.join(root, "docs", "workflow", "SPEC.md");
if (fs.existsSync(spec)) {
  lines.push(
    "",
    "This repository has a product spec at `docs/workflow/SPEC.md`. Read it before building anything: its §5 is the slice table, and `/product-build` takes the topmost row that is not `landed` rather than whatever the conversation suggests.",
  );
}

/**
 * `STATE.md` is where the work *got to*. It is short and changes every session,
 * so it is printed in full — without it the loop restarts every time a session
 * does.
 */
const state = path.join(root, "docs", "workflow", "STATE.md");
if (fs.existsSync(state)) {
  lines.push(
    "",
    "Work in progress — `docs/workflow/STATE.md` says:",
    "",
    fs.readFileSync(state, "utf8").trim(),
  );
}

if (!postgres()) {
  lines.push(
    "Postgres is not running, so the database-backed tests will skip rather than fail. `docker compose up -d` before trusting a green `bun run test`.",
  );
}

console.log(lines.join("\n"));
