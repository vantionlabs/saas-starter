#!/usr/bin/env node
// Re-vendors a read-only upstream copy under repos/.
//
// `git subtree pull` is not used, and cannot be: this repository's history is
// squashed at publication and every repository generated from the template
// starts with no history at all, so there is no merge base for a pull to find.
// Removing the directory and adding the subtree afresh works in any history,
// and it never conflicts — which `pull --squash` routinely does across a tree
// this size.
//
//   node scripts/vendor.mjs [name...]   (default: every source)

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SOURCES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "vendor-sources.json"), "utf8"),
);

const git = (...args) => execFileSync("git", args, { cwd: ROOT, stdio: "inherit" });

const isClean = () =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim() === "";

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(SOURCES);

for (const name of names) {
  if (SOURCES[name] === undefined) {
    console.error(`unknown source: ${name}\nknown: ${Object.keys(SOURCES).join(", ")}`);
    process.exit(1);
  }
}

// A dirty tree makes the commits below unreviewable, and `subtree add` refuses
// one anyway. Fail before touching anything rather than halfway through.
if (!isClean()) {
  console.error("working tree is not clean — commit or stash first");
  process.exit(1);
}

for (const name of names) {
  const { prefix, url, ref, catalogPin } = SOURCES[name];

  console.log(`\n==> ${name} (${prefix}) from ${url}#${ref}`);

  if (fs.existsSync(path.join(ROOT, prefix))) {
    git("rm", "-r", "--quiet", prefix);
    git("commit", "--quiet", "-m", `drop the vendored ${name} copy`);
  }

  git("subtree", "add", `--prefix=${prefix}`, url, ref, "--squash");

  console.log(`    vendored. check it against the \`${catalogPin}\` pin in pnpm-workspace.yaml.`);
}
