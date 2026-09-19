import { AdminSql } from "@/AdminSql.js";
import { crossTenant } from "@/CrossTenant.js";
import { CurrentStaff, Staff } from "@/Staff.js";
import { listStaffTrail } from "@/StaffTrail.js";
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
  new Staff({ userId: "staff_trail", email: "reviewer@vantion.co" }),
);

const live = Layer.mergeAll(adminSql, staff).pipe(
  Layer.provideMerge(PgLive),
  Layer.provideMerge(PgPoolTest),
);

describe.skipIf(testDbUrl() === undefined || adminDbUrl() === undefined)("staff trail", () => {
  it.effect("returns what crossTenant wrote", () =>
    Effect.gen(function*() {
      const reason = `TRAIL-${Date.now()}`;

      yield* crossTenant(
        { action: "ListOrganizations", reason },
        (sql) => sql`select 1`,
      );

      const trail = yield* listStaffTrail(200);
      const entry = trail.find((row) => row.reason === reason);

      expect(entry?.staffEmail).toBe("reviewer@vantion.co");
      expect(entry?.action).toBe("ListOrganizations");
      // A read with no single tenant names none, rather than guessing at one.
      expect(entry?.organizationId).toBeUndefined();
    }).pipe(Effect.provide(live)));

  /**
   * The property the whole design rests on, asserted from the other side: the
   * application role cannot read this table, so the trail is not something a
   * compromised API can rewrite or even see.
   */
  it.effect("is unreadable on the application connection", () =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql`select 1 from "adminAudit"`;

      expect(rows).toHaveLength(0);
    }).pipe(Effect.provide(live)));

  /**
   * Reading the trail must not append to it. This is the one that would fail
   * silently and cost the most: a review that records itself grows the table it
   * is trying to make readable, and every subsequent review has more of its own
   * history to wade through.
   */
  it.effect("does not record itself", () =>
    Effect.gen(function*() {
      const admin = yield* AdminSql;

      const count = () =>
        admin<{ n: string; }>`select count(*) as "n" from "adminAudit"`.pipe(
          Effect.map((rows) => Number(rows[0]?.n ?? 0)),
        );

      const before = yield* count();
      yield* listStaffTrail(200);
      yield* listStaffTrail(200);

      expect(yield* count()).toBe(before);
    }).pipe(Effect.provide(live)));

  /**
   * The bound is in the contract, but the query has to honour it — a limit a
   * client can state and the server ignores is not a limit.
   */
  it.effect("returns no more than it was asked for", () =>
    Effect.gen(function*() {
      for (let i = 0; i < 3; i += 1) {
        yield* crossTenant(
          { action: "ListOrganizations", reason: `TRAIL-LIMIT-${i}` },
          (sql) => sql`select 1`,
        );
      }

      expect(yield* listStaffTrail(2)).toHaveLength(2);
    }).pipe(Effect.provide(live)));

  /**
   * Newest first. The trail is read to answer "what just happened", and a
   * reviewer paging from the beginning of time to reach today is one who stops
   * reviewing.
   */
  it.effect("is ordered newest first", () =>
    Effect.gen(function*() {
      const trail = yield* listStaffTrail(50);
      const times = trail.map((row) => row.at);

      expect(times).toEqual([...times].sort().reverse());
    }).pipe(Effect.provide(live)));
});
