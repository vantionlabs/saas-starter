import { AdminRpcs } from "@/AdminRpc.js";
import { AdminRpcLive } from "@/AdminRpcLive.js";
import { AdminSql } from "@/AdminSql.js";
import { CurrentStaff, Staff } from "@/Staff.js";
import { StaffResolver } from "@/StaffResolver.js";
import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { pgClientConfig, PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

const adminDbUrl = () => process.env["TEST_ADMIN_DB_URL"];

const ORG = "rpc_org";
const OTHER = "rpc_other";

const adminSql = Layer.effect(AdminSql)(
  PgClient.make({ url: Redacted.make(adminDbUrl() ?? ""), ...pgClientConfig }),
).pipe(Layer.provide(Reactivity.layer), Layer.orDie);

const staff = Layer.succeed(CurrentStaff)(
  new Staff({ userId: "staff_rpc", email: "support@vantion.co" }),
);

const live = AdminRpcLive.pipe(
  Layer.provideMerge(adminSql),
  Layer.provideMerge(staff),
  Layer.provideMerge(PgLive),
  Layer.provideMerge(PgPoolTest),
);

const seed = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  for (const org of [ORG, OTHER]) {
    yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
               values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
  }

  yield* withOrgScopeFor(
    ORG,
    sql`insert into "contact" ("id", "organizationId", "email", "fullName")
        values ('rpc_c1', ${ORG}, 'one@example.com', 'One')
        on conflict ("id") do nothing`,
  );
});

describe.skipIf(testDbUrl() === undefined || adminDbUrl() === undefined)("the admin api", () => {
  it.layer(live)("over every tenant", (it) => {
    it.effect("lists organizations, and records that somebody listed them", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AdminRpcs);

        yield* seed();

        const listed = yield* client.ListOrganizations({ reason: "SUP-3001" });
        const ids = listed.map((row) => row.id);

        expect(ids).toContain(ORG);
        expect(ids).toContain(OTHER);

        const admin = yield* AdminSql;
        const [entry] = yield* admin<{ action: string; organizationId: string | null; }>`
          select "action", "organizationId" from "adminAudit" where "reason" = 'SUP-3001'
        `;

        expect(entry?.action).toBe("ListOrganizations");
        /**
         * No organization, and that is the honest entry: listing everybody
         * concerns no one tenant, and naming one would make the trail harder to
         * read rather than easier.
         */
        expect(entry?.organizationId).toBeNull();
      }));

    it.effect("counts what is in one, and names it in the record", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AdminRpcs);

        yield* seed();

        const detail = yield* client.GetOrganization({
          organizationId: ORG,
          reason: "SUP-3002",
        });

        expect(detail.organization.slug).toBe(ORG);
        expect(detail.contacts).toBe(1);

        const admin = yield* AdminSql;
        const [entry] = yield* admin<{ organizationId: string | null; }>`
          select "organizationId" from "adminAudit" where "reason" = 'SUP-3002'
        `;

        expect(entry?.organizationId).toBe(ORG);
      }));

    /**
     * Counts, never contents. Everything this returns crosses the tenant
     * boundary, so the bar is what somebody cannot do their job without — and a
     * customer's contact names are not that.
     */
    it.effect("returns no tenant rows, only counts of them", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AdminRpcs);

        yield* seed();

        const detail = yield* client.GetOrganization({
          organizationId: ORG,
          reason: "SUP-3003",
        });

        expect(JSON.stringify(detail)).not.toContain("one@example.com");
      }));

    it.effect("says so when an organization has gone, rather than crashing", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AdminRpcs);

        const failure = yield* Effect.flip(
          client.GetOrganization({ organizationId: "deleted_long_ago", reason: "SUP-3004" }),
        );

        expect(failure._tag).toBe("OrganizationNotFound");

        /**
         * And the attempt is still recorded. A trail that kept only successful
         * reads would be missing exactly the ones worth reviewing.
         */
        const admin = yield* AdminSql;
        const rows = yield* admin`select 1 from "adminAudit" where "reason" = 'SUP-3004'`;
        expect(rows).toHaveLength(1);
      }));

    it.effect("refuses a request with no reason, before reading anything", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AdminRpcs);

        const failure = yield* Effect.flip(client.ListOrganizations({ reason: "  " }));
        expect(failure._tag).toBe("ReasonRequired");

        const admin = yield* AdminSql;
        const rows = yield* admin`select 1 from "adminAudit" where "reason" = '  '`;
        expect(rows, "a refused request still wrote a record").toHaveLength(0);
      }));
  });
});

describe.skipIf(testDbUrl() === undefined)("staff", () => {
  it.layer(StaffResolver.layer.pipe(Layer.provideMerge(PgPoolTest)))("resolution", (it) => {
    const user = Effect.fnUntraced(function*(
      id: string,
      role: string | null,
      banned: boolean,
      twoFactor = true,
    ) {
      const sql = yield* SqlClient.SqlClient;

      yield* sql`
        insert into "user" ("id", "name", "email", "emailVerified", "role", "banned",
                            "twoFactorEnabled", "createdAt", "updatedAt")
        values (${id}, ${id}, ${`${id}@example.com`}, true, ${role}, ${banned},
                ${twoFactor}, now(), now())
        on conflict ("id") do update set
          "role" = excluded."role",
          "banned" = excluded."banned",
          "twoFactorEnabled" = excluded."twoFactorEnabled"
      `;
    });

    it.effect("accepts somebody whose system role says staff", () =>
      Effect.gen(function*() {
        yield* user("staff_yes", "admin", false);

        const resolver = yield* StaffResolver;
        const resolved = yield* resolver.resolve("staff_yes");

        expect(resolved.email).toBe("staff_yes@example.com");
      }).pipe(Effect.provide(PgLive)));

    /**
     * An organization's owner is not staff. The two roles live in different
     * columns for exactly this reason: `member.role` is standing inside one
     * tenant, `user.role` is standing in the product.
     */
    it.effect("refuses an ordinary user, however senior in their own organization", () =>
      Effect.gen(function*() {
        yield* user("staff_no", null, false);

        const resolver = yield* StaffResolver;
        const failure = yield* Effect.flip(resolver.resolve("staff_no"));

        expect(failure._tag).toBe("NotStaff");
      }).pipe(Effect.provide(PgLive)));

    it.effect("refuses a banned account, which better-auth would too", () =>
      Effect.gen(function*() {
        yield* user("staff_banned", "admin", true);

        const resolver = yield* StaffResolver;
        const failure = yield* Effect.flip(resolver.resolve("staff_banned"));

        expect(failure._tag).toBe("NotStaff");
      }).pipe(Effect.provide(PgLive)));

    /**
     * The panel reads across every tenant, so its whole protection is that
     * somebody proved they are staff — which without a second factor is one
     * password and one session cookie.
     *
     * Checked on every request rather than at enrolment, so turning 2FA off
     * closes the panel immediately rather than at the end of a session.
     */
    it.effect("refuses staff who have not enrolled a second factor", () =>
      Effect.gen(function*() {
        yield* user("staff_no_2fa", "admin", false, false);

        const resolver = yield* StaffResolver;
        const failure = yield* Effect.flip(resolver.resolve("staff_no_2fa"));

        /**
         * Named, unlike every other refusal here. This caller has already
         * proved who they are, so there is nothing left to leak — and it is
         * the only refusal on this surface they can act on.
         */
        expect(failure._tag).toBe("TwoFactorRequired");
      }).pipe(Effect.provide(PgLive)));

    /** Unknown and not-staff are one answer, so neither confirms the other. */
    it.effect("refuses somebody who does not exist", () =>
      Effect.gen(function*() {
        const resolver = yield* StaffResolver;
        const failure = yield* Effect.flip(resolver.resolve("nobody_at_all"));

        expect(failure._tag).toBe("NotStaff");
      }));
  });
});
