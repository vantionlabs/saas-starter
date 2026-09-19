#!/usr/bin/env tsx
/**
 * Prints the Plugin API script that syncs these tokens into a Figma file.
 *
 * Printed rather than executed: writing to Figma needs the MCP server, a file
 * key and a seat that can edit, none of which belong in a build step. The
 * `/figma-tokens` command pipes this into `use_figma`.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { figmaVariables, figmaVariableScript } from "./src/figma.ts";

const command = Command.make(
  "figma",
  {
    json: Flag.boolean("json").pipe(
      Flag.withDescription("Print the variables as JSON instead of the plugin script."),
    ),
  },
  ({ json }) =>
    Console.log(json ? JSON.stringify(figmaVariables(), null, 2) : figmaVariableScript()),
);

NodeRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(NodeServices.layer)),
);
