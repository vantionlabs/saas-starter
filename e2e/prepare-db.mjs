#!/usr/bin/env node
// Gives the browser tests a Postgres of their own, on a port nothing else holds.
//
// Not the `docker compose` database: that one is bound to 5432, and a developer
// machine very often already has something there — a native Postgres on the
// loopback wins over a container bound to `*`, and the failure reads as "role
// does not exist" rather than as a port conflict. A container on an
// ephemeral port cannot collide with anything.
//
// The container outlives this process on purpose. `pnpm --filter @vantion/e2e
// test` runs this first, Playwright second, and `stop-db.mjs` last, so the
// database is up for the whole run and gone afterwards.
//
// Set E2E_DATABASE_URL to skip all of this and use a database you supply — a CI
// service container, or your own instance.

import { execFileSync } from "node:child_process";
import * as net from "node:net";
import * as path from "node:path";
import { writeEnv } from "./env-file.mjs";

const ROOT = path.join(import.meta.dirname, "..");

const CONTAINER = "vantion-e2e-postgres";

/** Asks the OS for a free port by binding one and letting go. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });

const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();

const migrate = (url) =>
  execFileSync("pnpm", ["--filter", "@vantion/database", "migrate"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

// An externally supplied database wins, and needs nothing started or migrated
// beyond the schema itself.
const supplied = process.env["E2E_DATABASE_URL"];
if (supplied !== undefined) {
  migrate(supplied);
  writeEnv(supplied, null);
  console.log("e2e database ready (supplied)");
  process.exit(0);
}

try {
  docker("info");
} catch {
  console.error(
    "Docker is not running.\n"
      + "Start it, or point E2E_DATABASE_URL at a Postgres of your own.",
  );
  process.exit(1);
}

// A container left behind by an interrupted run holds its port and its data.
try {
  docker("rm", "-f", CONTAINER);
} catch {
  // Nothing to remove, which is the normal case.
}

const port = await freePort();

docker(
  "run",
  "-d",
  "--name",
  CONTAINER,
  "-e",
  "POSTGRES_DB=vantion_e2e",
  "-e",
  "POSTGRES_USER=vantion",
  "-e",
  "POSTGRES_PASSWORD=vantion",
  "-p",
  `127.0.0.1:${port}:5432`,
  // No volume: the tests want an empty database every run, and not persisting
  // one is simpler than dropping it.
  "postgres:17-alpine",
);

const url = `postgresql://vantion:vantion@127.0.0.1:${port}/vantion_e2e`;

// `pg_isready` reports the server is accepting connections, which is the thing
// the migration runner is about to need. Polling it beats a fixed sleep.
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    docker("exec", CONTAINER, "pg_isready", "-U", "vantion", "-d", "vantion_e2e");
    break;
  } catch {
    if (Date.now() > deadline) {
      console.error(`Postgres did not become ready within 60s:\n${docker("logs", CONTAINER)}`);
      process.exit(1);
    }
  }
}

// The same runner `pnpm dev` uses, so the browser tests and a developer's own
// database cannot converge on different schemas.
migrate(url);
writeEnv(url, CONTAINER);

console.log(`e2e database ready on port ${port}`);
