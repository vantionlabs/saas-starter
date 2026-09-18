#!/usr/bin/env node
// Writes src/tokens.css from the tokens, or checks that it is current.
//
// The stylesheet is committed rather than built on demand: Tailwind reads it at
// build time, and a generated file missing from the tree is a file the web app
// cannot start without a prior step. `test/tokens.test.ts` fails when the two
// drift, which is what keeps "committed" and "generated" from disagreeing.
//
//   tsx build.mjs [--check]

import * as fs from "node:fs";
import * as path from "node:path";
import { renderCss } from "./src/css.ts";

const target = path.join(import.meta.dirname, "src", "tokens.css");
const rendered = renderCss();

if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";

  if (current !== rendered) {
    console.error("src/tokens.css is out of date. Run `pnpm --filter @vantion/tokens build:css`.");
    process.exit(1);
  }

  console.log("tokens.css is current");
} else {
  fs.writeFileSync(target, rendered);
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}
