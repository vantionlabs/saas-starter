#!/usr/bin/env tsx
/**
 * Prepares a database, runs Playwright, and tears the database down again — the
 * last step in a `finally`, so a failing run leaves nothing behind.
 *
 * A script rather than pnpm's `pretest`/`posttest` pair because `posttest` does
 * not run when `test` fails, which is exactly when a leftover container is most
 * likely and least wanted.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { spawnSync } from "node:child_process";

const HERE = import.meta.dirname;

const spawn = (command: string, args: ReadonlyArray<string>) =>
  spawnSync(command, [...args], { cwd: HERE, stdio: "inherit", shell: false }).status ?? 1;

const command = Command.make(
  "e2e",
  {
    /**
     * Whatever Playwright should get. Variadic rather than parsed, because
     * these are another tool's flags and this one has no business knowing them.
     */
    playwright: Argument.string("playwright-arg").pipe(
      Argument.withDescription("Passed through to `playwright test`."),
      Argument.variadic(),
    ),
  },
  Effect.fnUntraced(function*({ playwright }) {
    const prepared = spawn("pnpm", ["exec", "tsx", "prepare-db.ts"]);

    if (prepared !== 0) return yield* Effect.sync(() => process.exit(prepared));

    let status = 1;

    try {
      status = spawn("pnpm", ["exec", "playwright", "test", ...playwright]);
    } finally {
      spawn("pnpm", ["exec", "tsx", "stop-db.ts"]);
    }

    if (status !== 0) return yield* Effect.sync(() => process.exit(status));
  }),
);

NodeRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(NodeServices.layer)),
);
