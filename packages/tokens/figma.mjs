#!/usr/bin/env node
// Prints the Plugin API script that syncs these tokens into a Figma file.
//
// Printed rather than executed: writing to Figma needs the MCP server, a file
// key and a seat that can edit, none of which belong in a build step. The
// `/figma-tokens` command pipes this into `use_figma`.
//
//   tsx figma.mjs [--json]

import { figmaVariables, figmaVariableScript } from "./src/figma.ts";

console.log(
  process.argv.includes("--json")
    ? JSON.stringify(figmaVariables(), null, 2)
    : figmaVariableScript(),
);
