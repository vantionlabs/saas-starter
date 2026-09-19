#!/usr/bin/env node
// Runs the test set and applies the gate.
//
//   pnpm evals                  run and report
//   pnpm evals --update-baseline  record what this run scored
//
// The baseline it writes names the model that produced it, because a score
// without that is a number nobody can act on. Updating it is a deliberate act
// with a diff somebody reviews — which is the whole point of keeping it in the
// repository rather than in a dashboard.

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.join(import.meta.dirname, "..");
const args = process.argv.slice(2);

/**
 * Run from the repository root so `.env` and the database are the ones `pnpm
 * dev` uses, but load `tsx` from this package's own `node_modules` — Node
 * resolves a bare `--import` specifier against the working directory, and this
 * package is where tsx is installed.
 */
execFileSync(
  "node",
  [
    "--import",
    pathToFileURL(path.join(import.meta.dirname, "node_modules", "tsx", "dist", "loader.mjs")).href,
    "--conditions=development",
    "--env-file-if-exists=.env",
    path.join(import.meta.dirname, "src", "main.ts"),
    ...args,
  ],
  { cwd: ROOT, stdio: "inherit" },
);
