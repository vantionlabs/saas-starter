#!/usr/bin/env bun
/** Removes the container `prepare-db.ts` started, if it started one. */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { execFileSync } from "node:child_process";
import { clearEnv, readEnv } from "./env-file.js";

const command = Command.make(
  "stop-db",
  {},
  () =>
    Effect.sync(() => {
      const env = readEnv();

      if (env?.container != null) {
        try {
          execFileSync("docker", ["rm", "-f", env.container], { stdio: "ignore" });
        } catch {
          // Already gone, which is fine.
        }
      }

      clearEnv();
    }),
);

BunRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer)),
);
