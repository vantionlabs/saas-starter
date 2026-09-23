#!/usr/bin/env bun
/**
 * Runs the test set and applies the gate.
 *
 *   bun run evals                    run and report
 *   bun run evals --update-baseline  record what this run scored
 *
 * The baseline it writes names the model that produced it, because a score
 * without that is a number nobody can act on. Updating it is a deliberate act
 * with a diff somebody reviews — which is the whole point of keeping it in the
 * repository rather than in a dashboard.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.join(import.meta.dirname, "..");

const command = Command.make(
  "evals",
  {
    /**
     * Passed through. The suite's own flags are its business, and repeating
     * them here would be two places to keep in step.
     */
    rest: Argument.String("arg").pipe(
      Argument.withDescription("Passed through to the eval runner, e.g. --update-baseline."),
      Argument.variadic(),
    ),
  },
  ({ rest }) =>
    Effect.sync(() => {
      /**
       * Run from the repository root so `.env` and the database are the ones
       * `bun run dev` uses, but load `tsx` from this package's own
       * `node_modules` — Node resolves a bare `--import` specifier against the
       * working directory, and this package is where tsx is installed.
       */
      execFileSync(
        "node",
        [
          "--import",
          pathToFileURL(
            path.join(import.meta.dirname, "node_modules", "tsx", "dist", "loader.mjs"),
          ).href,
          "--conditions=development",
          "--env-file-if-exists=.env",
          path.join(import.meta.dirname, "src", "main.ts"),
          ...rest,
        ],
        { cwd: ROOT, stdio: "inherit" },
      );
    }),
);

/**
 * Everything after the script name belongs to the eval runner, so it is handed over
 * behind `--`. The CLI refuses a flag it does not declare, and a `--` typed by
 * hand does not survive: Bun strips one that directly follows the script.
 */
const forwarded = process.argv.slice(2);

BunRuntime.runMain(
  Command.runWith(command, { version: "0.0.0" })(
    forwarded[0] === "--" ? forwarded : ["--", ...forwarded],
  ).pipe(Effect.provide(BunServices.layer)),
);
