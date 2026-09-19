import { AdminSql } from "@/AdminSql.js";
import { findPerson } from "@/People.js";
import { CurrentStaff, Staff } from "@/Staff.js";
import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { pgClientConfig, PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";

const adminDbUrl = () => process.env["TEST_ADMIN_DB_URL"];

const adminSql = Layer.effect(AdminSql)(
  Effect.gen(function*() {
    return yield* PgClient.make({
      url: Redacted.make(adminDbUrl() ?? ""),
      ...pgClientConfig,
    });
  }),
).pipe(Layer.provide(Reactivity.layer), Layer.orDie);

const staff = Layer.succeed(CurrentStaff)(
  new Staff({ userId: "staff_people", email: "support@vantion.co" }),
);

const live = Layer.mergeAll(adminSql, staff).pipe(
  Layer.provideMerge(PgLive),
  Layer.provideMerge(PgPoolTest),
);

const ORG = "people_org";
const EMAIL = "Findable.Person@Example.test";

/**
 * Seeded through the application connection, which is the product's own write
 * path. A fixture needing more privilege than the application has is a fixture
 * describing a state the application cannot produce.
 */
const seed = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "user" ("id", "name", "email", "emailVerified", "updatedAt")
             values ('people_user', 'Findable Person', ${EMAIL}, true, now())
             on conflict ("id") do nothing`;
  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${ORG}, 'People Org', ${ORG}, now())
             on conflict ("id") do nothing`;
  yield* sql`insert into "member" ("id", "organizationId", "userId", "role", "createdAt")
             values ('people_member', ${ORG}, 'people_user', 'owner', now())
             on conflict ("id") do nothing`;
});

describe.skipIf(testDbUrl() === undefined || adminDbUrl() === undefined)("find a person", () => {
  it.effect("returns who they are and where they belong", () =>
    Effect.gen(function*() {
      yield* seed();

      const person = yield* findPerson(EMAIL, "SUP-9001");

      expect(person.name).toBe("Findable Person");
      expect(person.staff).toBe(false);
      expect(person.memberships.map((m) => m.organizationId)).toContain(ORG);
      expect(person.memberships.map((m) => m.role)).toContain("owner");
    }).pipe(Effect.provide(live)));

  /**
   * Addresses are not case sensitive to anybody who types one, and a support
   * engineer copying from a ticket will not match the casing in the database.
   */
  it.effect("matches an address whatever its case", () =>
    Effect.gen(function*() {
      yield* seed();

      const person = yield* findPerson(EMAIL.toLowerCase(), "SUP-9002");

      expect(person.id).toBe("people_user");
    }).pipe(Effect.provide(live)));

  /**
   * The property that keeps this a lookup rather than a directory: a fragment
   * of a real address finds nothing. If this ever starts passing, somebody has
   * turned the query into `like` and made a screen that lists customers.
   */
  it.effect("refuses a partial address", () =>
    Effect.gen(function*() {
      yield* seed();

      const result = yield* findPerson("findable", "SUP-9003").pipe(Effect.result);

      expect(result._tag).toBe("Failure");
    }).pipe(Effect.provide(live)));

  /** The attempt is recorded even when it finds nobody. */
  it.effect("records a search that found nothing", () =>
    Effect.gen(function*() {
      yield* findPerson("nobody@example.test", "SUP-9004").pipe(Effect.result);

      const admin = yield* AdminSql;
      const rows = yield* admin`select 1 from "adminAudit" where "reason" = 'SUP-9004'`;

      expect(rows).toHaveLength(1);
    }).pipe(Effect.provide(live)));
});
