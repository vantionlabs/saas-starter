import { AdminSql } from "@/AdminSql.js";
import { crossTenant } from "@/CrossTenant.js";
import { CurrentStaff, Staff } from "@/Staff.js";
import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { pgClientConfig } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";

const adminDbUrl = () => process.env["TEST_ADMIN_DB_URL"];

const MINE = "admin_mine";
const THEIRS = "admin_theirs";

/**
 * The real `admin` role, pointed at the test database.
 *
 * `layerAdminSql` reads `ADMIN_DATABASE_URL` from the environment, which the
 * suite does not set; this is the same construction against the URL the global
 * setup provisioned. What matters is that it is a *different connection as a
 * different role*, which is the whole thing under test.
 */
const adminSql = Layer.effect(AdminSql)(
  Effect.gen(function*() {
    return yield* PgClient.make({
      url: Redacted.make(adminDbUrl() ?? ""),
      ...pgClientConfig,
    });
  }),
).pipe(Layer.provide(Reactivity.layer), Layer.orDie);

const staff = Layer.succeed(CurrentStaff)(
  new Staff({ userId: "staff_1", email: "support@vantion.co" }),
);

const live = Layer.mergeAll(adminSql, staff).pipe(
  Layer.provideMerge(PgLive),
  Layer.provideMerge(PgPoolTest),
);

const seed = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  for (const org of [MINE, THEIRS]) {
    yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
               values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
    yield* withOrgScopeFor(
      org,
      sql`insert into "contact" ("id", "organizationId", "email", "fullName")
          values (${`c_${org}`}, ${org}, ${`${org}@example.com`}, ${org})
          on conflict ("id") do nothing`,
    );
  }
});

describe.skipIf(testDbUrl() === undefined || adminDbUrl() === undefined)("cross-tenant", () => {
  it.layer(live)("the boundary", (it) => {
    /**
     * The half that matters most, and the one a security review asks about: the
     * application's own connection cannot see across tenants even when the code
     * asks it to. Not a policy in a handler — a policy in Postgres, against a
     * role that holds no way around it.
     */
    it.effect("is invisible to the application's connection", () =>
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;

        yield* seed();

        const unscoped = yield* sql<{ id: string; }>`select "id" from "contact"`;
        expect(unscoped, "the app connection read rows with no organization scope")
          .toHaveLength(0);

        const scoped = yield* withOrgScopeFor(
          MINE,
          sql<{ id: string; }>`select "id" from "contact"`,
        );
        expect(scoped.map((row) => row.id)).toEqual([`c_${MINE}`]);
      }));

    it.effect("is what the admin connection is for", () =>
      Effect.gen(function*() {
        yield* seed();

        const rows = yield* crossTenant(
          { action: "ListContacts", reason: "SUP-1024" },
          (sql) => sql<{ id: string; }>`select "id" from "contact" where "id" like 'c_admin_%'`,
        );

        expect(rows.map((row) => row.id).sort()).toEqual([`c_${MINE}`, `c_${THEIRS}`]);
      }));

    /**
     * Written before the read and in the same transaction, so a read that
     * succeeded cannot have gone unrecorded.
     */
    it.effect("records who looked at what, and why", () =>
      Effect.gen(function*() {
        yield* seed();

        yield* crossTenant(
          { action: "GetOrganization", organizationId: THEIRS, reason: "SUP-2048" },
          (sql) => sql`select 1 from "organization" where "id" = ${THEIRS}`,
        );

        const admin = yield* AdminSql;
        const [entry] = yield* admin<{
          staffEmail: string;
          action: string;
          organizationId: string | null;
          reason: string;
        }>`
          select "staffEmail", "action", "organizationId", "reason" from "adminAudit"
          where "reason" = 'SUP-2048'
        `;

        expect(entry?.staffEmail).toBe("support@vantion.co");
        expect(entry?.action).toBe("GetOrganization");
        expect(entry?.organizationId).toBe(THEIRS);
      }));

    /** A read with nothing said about why is refused before it runs. */
    it.effect("refuses a read with no reason", () =>
      Effect.gen(function*() {
        const failure = yield* Effect.flip(
          crossTenant(
            { action: "ListOrganizations", reason: "   " },
            (sql) => sql`select 1`,
          ),
        );

        expect(failure._tag).toBe("ReasonRequired");
      }));

    /**
     * The staff trail is the one table nobody may read — not even the role that
     * owns it, because it runs the migrations. A record of who read a
     * customer's data is worth nothing if the process that might have leaked it
     * can also edit the evidence.
     */
    it.effect("keeps its own trail out of the application's reach", () =>
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;

        const rows = yield* sql`select 1 from "adminAudit"`;
        expect(rows).toHaveLength(0);

        const refused = yield* Effect.flip(
          sql`insert into "adminAudit" ("id", "staffUserId", "staffEmail", "action", "reason")
              values ('forged', 'nobody', 'nobody@example.com', 'Forged', 'none')`,
        );
        expect(refused._tag).toBe("SqlError");
      }));
  });
});
