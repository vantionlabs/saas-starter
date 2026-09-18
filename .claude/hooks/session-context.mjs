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

const effectVersion = () => {
  const catalog = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  return catalog.match(/^\s+effect:\s*(\S+)/m)?.[1] ?? "unknown";
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
  vendored
    ? "Its source is vendored at `repos/effect`. Read the real signature there before using an API you have not already read this session; it outranks RULES.md, knowledge/ and your own recall, in that order."
    : "`repos/effect` is MISSING. Run `pnpm vendor` — without it there is no authority for Effect APIs and recall is not one.",
];

/**
 * A thirty-day sprint outlives any context window. `docs/sprint/STATE.md` is
 * where each phase writes what it did, and this is the half that reads it back —
 * without it the loop restarts every time a session does.
 */
const sprint = path.join(root, "docs", "sprint", "STATE.md");
if (fs.existsSync(sprint)) {
  lines.push(
    "",
    "Sprint in progress — `docs/sprint/STATE.md` says:",
    "",
    fs.readFileSync(sprint, "utf8").trim(),
  );
}

if (!postgres()) {
  lines.push(
    "Postgres is not running, so the database-backed tests will skip rather than fail. `docker compose up -d` before trusting a green `pnpm test`.",
  );
}

console.log(lines.join("\n"));
