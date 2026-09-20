#!/usr/bin/env node
// Formats the file that just changed, lints it, and type-checks the one package
// it belongs to.
//
// Scoped on purpose. `bun run check` builds every project reference and takes long
// enough that running it after each edit would make the editing unbearable;
// `tsc -b` on the owning package costs a second or two and catches the Effect v4
// drift this repository exists to guard against, at the moment it happens rather
// than at commit.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { isCheckableSource, owningProject, projectDir, readInput, report } from "./lib.mjs";

const input = await readInput();
const filePath = input.tool_input?.file_path;

if (!isCheckableSource(filePath) || !fs.existsSync(filePath)) process.exit(0);

const root = projectDir();

/** Runs a workspace binary, returning its combined output when it fails. */
const run = (bin, args) => {
  try {
    execFileSync(path.join(root, "node_modules", ".bin", bin), args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return undefined;
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || `${bin} failed`;
  }
};

// Formatting first: it rewrites the file, and linting the formatted text is what
// the commit will see.
run("dprint", ["fmt", filePath]);

const findings = [];

const lint = run("oxlint", ["--disable-nested-config", filePath]);
if (lint !== undefined) findings.push("oxlint:", lint);

const project = owningProject(filePath, root);
if (project !== undefined) {
  const types = run("tsc", ["-b", path.join(project, "tsconfig.src.json")]);
  if (types !== undefined) findings.push("tsc:", types);
}

report(
  findings.length === 0
    ? []
    : ["The file just written does not pass the repository's own checks:", "", ...findings],
);
