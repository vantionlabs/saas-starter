#!/usr/bin/env node
// Removes the container `prepare-db.mjs` started, if it started one.

import { execFileSync } from "node:child_process";
import { clearEnv, readEnv } from "./env-file.mjs";

const env = readEnv();

if (env?.container != null) {
  try {
    execFileSync("docker", ["rm", "-f", env.container], { stdio: "ignore" });
  } catch {
    // Already gone, which is fine.
  }
}

clearEnv();
