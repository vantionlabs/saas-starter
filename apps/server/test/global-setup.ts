import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "@vantion/database/Migrations";
import { execFileSync } from "node:child_process";
import * as Pg from "pg";

let container: StartedPostgreSqlContainer | undefined;

/**
 * Testcontainers needs a running daemon. Probing keeps `bun run test` green on
 * machines without Docker — tests that need `TEST_DB_URL` skip instead.
 */
const hasDocker = () => {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/**
 * The two roles the schema's security model assumes, created before anything is
 * migrated.
 *
 * A container's bootstrap user is a **superuser**, and a superuser ignores
 * row-level security even on a FORCEd table. Tests run as one therefore prove
 * nothing about isolation while looking exactly as though they do — which is
 * how a handler that relied on the policy alone passed its tests and read every
 * organization's subscription in production.
 *
 * `vantion` is what the application connects as and it can bypass nothing.
 * `admin` is for the cross-tenant surface and is the only role here that may,
 * which is the whole of that boundary: it lives in Postgres rather than in a
 * reviewer's attention.
 */
const provision = async (bootstrapUri: string, database: string) => {
  const pool = new Pg.Pool({ connectionString: bootstrapUri });

  try {
    /**
     * `createrole` because `OrgScope.test.ts` makes a role of its own to assume.
     * It is not a way back to bypassing: since Postgres 16 a `createrole` role
     * cannot grant an attribute it does not itself hold.
     */
    await pool.query(
      `do $$ begin
         if not exists (select from pg_roles where rolname = 'vantion') then
           create role vantion login password 'vantion' nosuperuser nobypassrls createrole;
         end if;
         if not exists (select from pg_roles where rolname = 'admin') then
           create role admin login password 'admin' nosuperuser bypassrls;
         end if;
       end $$;`,
    );

    await pool.query(`grant all on database "${database}" to vantion`);
    await pool.query(`grant all on schema public to vantion`);
    await pool.query(`grant connect on database "${database}" to admin`);
    await pool.query(`grant usage on schema public to admin`);
  } finally {
    await pool.end();
  }
};

/** The same host and database, as one of the roles provisioned above. */
const asRole = (uri: string, role: string) => {
  const url = new URL(uri);
  url.username = role;
  url.password = role;

  return url.toString();
};

export async function setup() {
  // An externally supplied database wins: it lets a developer without Docker
  // point at a local Postgres, and lets CI reuse a service container.
  if (process.env["TEST_DB_URL"] === undefined) {
    if (!hasDocker()) return;

    container = await new PostgreSqlContainer("postgres:17-alpine").start();

    const bootstrap = container.getConnectionUri();
    await provision(bootstrap, container.getDatabase());

    process.env["TEST_DB_URL"] = asRole(bootstrap, "vantion");
    process.env["TEST_ADMIN_DB_URL"] = asRole(bootstrap, "admin");
  }

  // The same runner the `migrate` script uses, so a container and a developer's
  // own database cannot converge on different schemas. Run as `vantion`, which
  // therefore owns the tables — and owns them without being exempt from their
  // policies, because every one of them is FORCEd.
  await migrate(process.env["TEST_DB_URL"]);

  /**
   * `admin` needs its grants after the tables exist; `grant on all tables`
   * covers what is there rather than what arrives later.
   */
  if (process.env["TEST_ADMIN_DB_URL"] !== undefined) {
    const pool = new Pg.Pool({ connectionString: process.env["TEST_DB_URL"] });

    try {
      await pool.query(
        `grant select, insert, update, delete on all tables in schema public to admin`,
      );
    } finally {
      await pool.end();
    }
  }
}

export async function teardown() {
  await container?.stop();
}
