#!/usr/bin/env tsx
/**
 * Gives the browser tests a Postgres of their own, on a port nothing else holds.
 *
 * Not the `docker compose` database: that one is bound to 5432, and a developer
 * machine very often already has something there — a native Postgres on the
 * loopback wins over a container bound to `*`, and the failure reads as "role
 * does not exist" rather than as a port conflict. A container on an ephemeral
 * port cannot collide with anything.
 *
 * The container outlives this process on purpose. `run.ts` starts this first,
 * Playwright second, and `stop-db.ts` last, so the database is up for the whole
 * run and gone afterwards.
 *
 * Set `E2E_DATABASE_URL` to skip all of this and use a database you supply — a
 * CI service container, or your own instance.
 */
import { execFileSync } from "node:child_process";
import * as net from "node:net";
import * as path from "node:path";
import { writeEnv } from "./env-file.js";

const ROOT = path.join(import.meta.dirname, "..");

const CONTAINER = "vantion-e2e-postgres";

/** Asks the OS for a free port by binding one and letting go. */
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as net.AddressInfo;
      server.close(() => resolve(address.port));
    });
  });

const docker = (...args: ReadonlyArray<string>) =>
  execFileSync("docker", [...args], { encoding: "utf8" }).trim();

/** Same, but never prints — for calls whose failure is an expected outcome. */
const dockerQuietly = (...args: ReadonlyArray<string>) =>
  execFileSync("docker", [...args], { stdio: "ignore" });

const migrate = (url: string) =>
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
  dockerQuietly("rm", "-f", CONTAINER);
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
  // The bootstrap user is a superuser, and a superuser ignores row-level
  // security even on a FORCEd table. The application must not be one, so this
  // container bootstraps as `postgres` and the app role is made below.
  "-e",
  "POSTGRES_USER=postgres",
  "-e",
  "POSTGRES_PASSWORD=postgres",
  "-p",
  `127.0.0.1:${port}:5432`,
  // No volume: the tests want an empty database every run, and not persisting
  // one is simpler than dropping it.
  "postgres:17-alpine",
);

const url = `postgresql://vantion:vantion@127.0.0.1:${port}/vantion_e2e`;

// A real query against the target database, not `pg_isready`.
//
// The entrypoint starts the server on a unix socket to bootstrap it, and
// `pg_isready` says yes during that window — before `POSTGRES_DB` exists. The
// first thing to touch it then fails with "database does not exist", which
// reads like a configuration error rather than a race.
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    dockerQuietly(
      "exec",
      CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "vantion_e2e",
      "-c",
      "select 1",
    );
    break;
  } catch {
    if (Date.now() > deadline) {
      console.error(`Postgres did not become ready within 60s:\n${docker("logs", CONTAINER)}`);
      process.exit(1);
    }
  }
}

// The two roles the schema's security model assumes.
//
// `vantion` is what the application connects as and can bypass nothing, so the
// browser suite proves isolation rather than assuming it. `admin` is the
// cross-tenant role and is the only one here that may bypass — the boundary
// lives in Postgres rather than in a reviewer's attention.
const psql = (sql: string) =>
  docker(
    "exec",
    "-e",
    "PGPASSWORD=postgres",
    CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-d",
    "vantion_e2e",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  );

psql(
  `do $$ begin
     if not exists (select from pg_roles where rolname = 'vantion') then
       create role vantion login password 'vantion' nosuperuser nobypassrls createrole;
     end if;
     if not exists (select from pg_roles where rolname = 'admin') then
       create role admin login password 'admin' nosuperuser bypassrls;
     end if;
   end $$;`,
);
psql(`grant all on database "vantion_e2e" to vantion`);
psql(`grant all on schema public to vantion`);
psql(`grant connect on database "vantion_e2e" to admin`);
psql(`grant usage on schema public to admin`);

// The same runner `pnpm dev` uses, so the browser tests and a developer's own
// database cannot converge on different schemas. Run as `vantion`, which
// therefore owns the tables — and owns them without being exempt from their
// policies, because every one of them is FORCEd.
migrate(url);

psql(`grant select, insert, update, delete on all tables in schema public to admin`);
writeEnv(url, CONTAINER);

console.log(`e2e database ready on port ${port}`);
