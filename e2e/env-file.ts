/**
 * Where `prepare-db.ts` records the database it started, so
 * `playwright.config.ts` can point the servers at it and `stop-db.ts` can clean
 * it up.
 *
 * A file rather than an environment variable because the three run as separate
 * processes: the port is chosen at run time and a child cannot export it back.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type E2eEnv = { readonly url: string; readonly container: string | null; };

export const ENV_FILE = path.join(import.meta.dirname, ".e2e-env.json");

export const writeEnv = (url: string, container: string | null) =>
  fs.writeFileSync(ENV_FILE, JSON.stringify({ url, container }, null, 2) + "\n");

/** `undefined` when no run has prepared a database yet. */
export const readEnv = (): E2eEnv | undefined =>
  fs.existsSync(ENV_FILE) ? JSON.parse(fs.readFileSync(ENV_FILE, "utf8")) as E2eEnv : undefined;

export const clearEnv = () => fs.rmSync(ENV_FILE, { force: true });
