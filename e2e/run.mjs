#!/usr/bin/env node
// Prepares a database, runs Playwright, and tears the database down again —
// the last step in a `finally`, so a failing run leaves nothing behind.
//
// This is a script rather than pnpm's `pretest`/`posttest` pair because
// `posttest` does not run when `test` fails, which is exactly when a leftover
// container is most likely and least wanted.
//
//   node run.mjs [playwright args...]

import { spawnSync } from "node:child_process";

const HERE = import.meta.dirname;

const run = (command, args) =>
  spawnSync(command, args, { cwd: HERE, stdio: "inherit", shell: false }).status ?? 1;

const prepared = run("node", ["prepare-db.mjs"]);
if (prepared !== 0) process.exit(prepared);

let status = 1;
try {
  status = run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)]);
} finally {
  run("node", ["stop-db.mjs"]);
}

process.exit(status);
