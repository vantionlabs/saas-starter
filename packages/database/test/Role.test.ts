import { describe, expect, it } from "@effect/vitest";
import { PgTest, testDbUrl } from "@vantion/database/PgTest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * The guard on every other isolation test in this repository.
 *
 * A superuser — and any role holding BYPASSRLS — ignores row-level security
 * even on a FORCEd table, while `pg_class.relrowsecurity` keeps reading true.
 * Point the suite at one and every tenancy test still passes, having proved
 * nothing: that was the state of this repository until the role was fixed, and
 * it is why a handler that relied on the policy alone read every organization's
 * subscription before a test caught it for an unrelated reason.
 *
 * So this asserts the property the rest of them assume, and fails loudly rather
 * than letting them all quietly stop meaning anything.
 */
describe.skipIf(testDbUrl() === undefined)("the connection", () => {
  it.layer(PgTest)("the application makes", (it) => {
    it.effect("cannot bypass row-level security", () =>
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;

        const [role] = yield* sql<{
          name: string;
          superuser: boolean;
          bypassrls: boolean;
        }>`
          select rolname as name, rolsuper as superuser, rolbypassrls as bypassrls
          from pg_roles where rolname = current_user
        `;

        expect(role, "no row for current_user").toBeDefined();
        expect(role?.superuser, `${role?.name} is a superuser`).toBe(false);
        expect(role?.bypassrls, `${role?.name} holds BYPASSRLS`).toBe(false);
      }));

    /**
     * FORCE is the other half. Without it Postgres exempts a table's owner, and
     * the application owns every table here because it runs the migrations.
     */
    it.effect("is subject to the policies on tables it owns", () =>
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;

        const unforced = yield* sql<{ name: string; }>`
          select relname as name from pg_class
          where relrowsecurity = true and relforcerowsecurity = false
        `;

        expect(unforced.map((row) => row.name)).toEqual([]);
      }));
  });
});
