// Where `prepare-db.mjs` records the database it started, so `playwright.config.ts`
// can point the servers at it and `stop-db.mjs` can clean it up.
//
// A file rather than an environment variable because the three run as separate
// processes: the port is chosen at run time and a child cannot export it back.

import * as fs from "node:fs";
import * as path from "node:path";

export const ENV_FILE = path.join(import.meta.dirname, ".e2e-env.json");

export const writeEnv = (url, container) =>
  fs.writeFileSync(ENV_FILE, JSON.stringify({ url, container }, null, 2) + "\n");

/** `undefined` when no run has prepared a database yet. */
export const readEnv = () =>
  fs.existsSync(ENV_FILE) ? JSON.parse(fs.readFileSync(ENV_FILE, "utf8")) : undefined;

export const clearEnv = () => fs.rmSync(ENV_FILE, { force: true });
