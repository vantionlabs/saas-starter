#!/usr/bin/env node
// The part of RULES.md a regex can decide, checked on the file that just
// changed.
//
// Every rule here holds across the whole repository today, and that is the bar
// for adding one: a check that fires on existing code is a check somebody turns
// off in its first hour. `Effect.orDie` and `new Error` are deliberately absent
// — see .claude/hooks/README.md.

import * as fs from "node:fs";
import { isCheckableSource, readInput, report } from "./lib.mjs";

/**
 * Test fixtures and test infrastructure construct failures to test against, and
 * `RULES.md` exempts them. `PgTest.ts` lives in `src/` and is one of them, which
 * is why the exemption is on the name rather than the directory.
 */
const isTestCode = (filePath) =>
  /(^|\/)test\//.test(filePath) || /\.test\.tsx?$/.test(filePath)
  || /Test\.tsx?$/.test(filePath);

const RULES = [
  {
    pattern: /\bnew Error\s*\(/,
    skip: isTestCode,
    rule:
      "Do not use the global `Error` class in app code. Use `Schema.TaggedError` with a `_tag` discriminator.",
  },
  {
    pattern: /\bSchema\.Unknown\b/,
    rule:
      "Do not use `Schema.Unknown` in app code or AI output schemas. Use explicit `Schema.Struct` shapes or `Schema.Json`.",
  },
  {
    pattern: /if\s*\(\s*"_tag"\s+in\s/,
    rule:
      "Do not probe errors with checks like `if (\"_tag\" in error)`. Match on the typed error channel instead.",
  },
  {
    pattern: /from\s+"[^"]*\brepos\//,
    rule: "Never import from `repos/`. Application code imports from normal package dependencies.",
  },
  {
    pattern: /\bas\s+[A-Z][A-Za-z]*Id\b/,
    rule:
      "Construct branded IDs with the schema's own constructor, `EntityId.make(...)`, which validates. Never cast with `as EntityId`.",
  },
  {
    pattern: /\)\s*=>\s*Effect\.gen\(/,
    rule:
      "Effectful wrappers must use `Effect.fnUntraced` (or `Effect.fn` when spans are needed). Do not write `(...args) => Effect.gen(function* () { ... })`.",
  },
];

const input = await readInput();
const filePath = input.tool_input?.file_path;

if (!isCheckableSource(filePath) || !fs.existsSync(filePath)) process.exit(0);

const lines = fs.readFileSync(filePath, "utf8").split("\n");
const findings = [];

for (const [index, line] of lines.entries()) {
  // A line that is only a comment is describing the rule, not breaking it.
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;

  for (const { pattern, rule, skip } of RULES) {
    if (skip?.(filePath) === true) continue;
    if (pattern.test(line)) findings.push(`${filePath}:${index + 1}  ${rule}`);
  }
}

// A barrel is a whole file rather than a line in one.
if (/(^|\/)index\.ts$/.test(filePath)) {
  findings.push(`${filePath}  No barrel \`index.ts\` files. Import from the defining module.`);
}

report(
  findings.length === 0 ? [] : ["RULES.md violations in the file just written:", "", ...findings],
);
