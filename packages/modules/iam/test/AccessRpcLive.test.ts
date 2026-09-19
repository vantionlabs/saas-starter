import { AccessRpcLive } from "@/access/AccessRpcLive.js";
import { PermissionCache } from "@/access/CachedPermissions.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AccessRpcs, CustomRole, MemberOverride } from "@vantion/module-iam/access/AccessRpc";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, Entitlement } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

const identity = (org: string, role: string) =>
  new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role,
    permissions: Array.from(permissionsFor(role)),
  });

/**
 * The middleware is stubbed to inject a known caller — better-auth is not the
 * subject here, the handlers and their policies are. Everything below it is
 * production wiring, including the real database.
 */
const as = (org: string, role: string) =>
  AccessRpcLive.pipe(
    /**
     * These handlers drop cached permissions after they write. The cache is off
     * by default, so the no-op is what production runs too — what is under test
     * here is the writing, and `CachedPermissions.test.ts` covers the dropping.
     */
    Layer.provideMerge(PermissionCache.layerNoop),
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(CurrentUser, identity(org, role)),
            // These tests are about roles, so the plan must not be what refuses
            // them: `pro` carries every feature the access group is gated on.
            Effect.provideService(
              CurrentEntitlement,
              new Entitlement({ plan: "pro", status: "active", seats: 25 }),
            ),
          )
        ),
      ),
    ),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

/** Tests run concurrently, so each block owns its organizations outright. */
const seedOrg = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
});

describe.skipIf(testDbUrl() === undefined)("AccessRpcLive", () => {
  it.layer(as("org_roles", "owner"))("custom roles", (it) => {
    it.effect("round-trips through better-auth's storage shape", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AccessRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seedOrg("org_roles");
        yield* client.SetRole({
          role: new CustomRole({ role: "editor", permissions: ["contact:read", "contact:update"] }),
        });

        // Stored nested, the way better-auth reads it — not our flat form.
        const [row] = yield* sql<{ permission: string; }>`
          select "permission" from "organizationRole" where "organizationId" = 'org_roles'
        `;
        expect(JSON.parse(row?.permission ?? "{}")).toEqual({ contact: ["read", "update"] });

        const roles = yield* client.ListRoles();
        expect(roles.map((role) => role.role)).toEqual(["editor"]);
        expect([...roles[0]!.permissions].sort()).toEqual(["contact:read", "contact:update"]);

        yield* client.DeleteRole({ role: "editor" });
        expect(yield* client.ListRoles()).toHaveLength(0);
      }));
  });

  it.layer(as("org_scope", "owner"))("tenant isolation", (it) => {
    it.effect("cannot see or delete another organization's role", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AccessRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seedOrg("org_scope");
        yield* seedOrg("org_intruder");
        yield* sql`insert into "organizationRole"
                     ("id", "organizationId", "role", "permission", "createdAt")
                   values ('intruder', 'org_intruder', 'spy', '{"contact":["read"]}', now())
                   on conflict ("id") do nothing`;

        // The caller is in org_scope, so org_intruder's role is invisible…
        expect(yield* client.ListRoles()).toHaveLength(0);

        // …and naming it does not delete it either.
        yield* client.DeleteRole({ role: "spy" });
        const survivors = yield* sql`select 1 from "organizationRole" where "id" = 'intruder'`;
        expect(survivors).toHaveLength(1);
      }));
  });

  it.layer(as("org_denied", "member"))("a member", (it) => {
    // better-auth's default member holds `ac: ["read"]`, and the reconciliation
    // test forbids us exceeding it — so reading roles is allowed and only
    // writes are refused. This asymmetry is inherited, not chosen.
    it.effect("may read access control but not change it", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AccessRpcs);

        expect(yield* client.ListRoles()).toHaveLength(0);

        expect(
          yield* Effect.flip(
            client.SetRole({ role: new CustomRole({ role: "sneaky", permissions: [] }) }),
          ),
        ).toMatchObject({ _tag: "Forbidden", required: "ac:create" });

        expect(
          yield* Effect.flip(
            client.SetMemberOverride({
              override: new MemberOverride({
                memberId: "m1",
                permission: "organization:delete",
                granted: true,
              }),
            }),
          ),
        ).toMatchObject({ _tag: "Forbidden", required: "ac:update" });
      }));
  });
});
