import type { UsageRow } from "@/BillingRpc.js";
import { BillingRpcs } from "@/BillingRpc.js";
import { BillingRpcLive } from "@/BillingRpcLive.js";
import { StripeClient } from "@/StripeClient.js";
import { describe, expect, it } from "@effect/vitest";
import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, Entitlement, limits } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { ConfigProvider, Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";

const identity = (org: string, role: string) =>
  new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role,
    permissions: Array.from(permissionsFor(role)),
  });

const as = (org: string, role: string, plan: "free" | "pro") =>
  BillingRpcLive.pipe(
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(CurrentUser, identity(org, role)),
            Effect.provideService(
              CurrentEntitlement,
              new Entitlement({ plan, status: "active", seats: limits[plan].seats }),
            ),
          )
        ),
      ),
    ),
    Layer.provideMerge(StripeClient.layerUnconfigured),
    Layer.provideMerge(
      ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEB_URL: "https://app.example.test" })),
    ),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

const seed = Effect.fnUntraced(function*(
  org: string,
  counts: { readonly members: number; readonly keys: number; readonly bytes: number; },
) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;

  /** The caller themselves. `file.uploadedBy` has a foreign key onto this. */
  yield* sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
             values (
               ${`user_${org}`}, ${org}, ${`${org}@example.com`}, true, now(), now()
             ) on conflict ("id") do nothing`;

  for (let n = 0; n < counts.members; n += 1) {
    const userId = `${org}_user_${n}`;

    yield* sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
               values (${userId}, ${userId}, ${`${userId}@example.com`}, true, now(), now())
               on conflict ("id") do nothing`;
    yield* sql`insert into "member" ("id", "organizationId", "userId", "role", "createdAt")
               values (${`${org}_m_${n}`}, ${org}, ${userId}, 'member', now())
               on conflict ("id") do nothing`;
  }

  /**
   * Through `withOrgScopeFor`, because the application role is `NOBYPASSRLS`
   * and an unscoped insert into a policied table is refused outright — the
   * product's own write path rather than a fixture describing a state it could
   * not produce.
   */
  yield* withOrgScopeFor(
    org,
    Effect.gen(function*() {
      for (let n = 0; n < counts.keys; n += 1) {
        yield* sql`insert into "apiKey" ("id", "organizationId", "name", "hash", "hint", "role")
                   values (${randomUUID()}, ${org}, ${`key ${n}`}, ${randomUUID()}, 'vk_…', 'member')`;
      }

      if (counts.bytes > 0) {
        yield* sql`
          insert into "file"
            ("id", "organizationId", "key", "name", "contentType", "size", "status", "uploadedBy")
          values (
            ${randomUUID()}, ${org}, ${`${org}/${randomUUID()}`}, 'one.pdf', 'application/pdf',
            ${counts.bytes}, 'ready', ${`user_${org}`}
          )
        `;
      }
    }),
  );
});

const rowFor = (rows: ReadonlyArray<UsageRow>, metric: string) =>
  rows.find((row) => row.metric === metric);

describe.skipIf(testDbUrl() === undefined)("usage", () => {
  it.layer(as("usage_free", "owner", "free"))("a free organization", (it) => {
    it.effect("counts what it holds against what the plan allows", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seed("usage_free", { members: 2, keys: 1, bytes: 5 * 1024 * 1024 });

        const rows = yield* client.GetUsage();

        expect(rowFor(rows, "seats")).toMatchObject({ used: 2, allowed: limits.free.seats });
        expect(rowFor(rows, "apiKeys")).toMatchObject({ used: 1, allowed: limits.free.apiKeys });
      }));
  });

  /**
   * Its own organization, because these tests run concurrently against one
   * database and a count is the one assertion another test's rows can change.
   */
  it.layer(as("usage_storage", "owner", "free"))("storage", (it) => {
    /**
     * Bytes on both sides, not megabytes on one. A row whose two numbers were
     * in different units would render five megabytes as five percent of a
     * hundred, and be wrong by a factor of a million the other way.
     */
    it.effect("is reported in bytes, limit included", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seed("usage_storage", { members: 0, keys: 0, bytes: 5 * 1024 * 1024 });

        expect(rowFor(yield* client.GetUsage(), "storage")).toMatchObject({
          unit: "bytes",
          used: 5 * 1024 * 1024,
          allowed: limits.free.storageMb * 1024 * 1024,
        });
      }));
  });

  /**
   * The number on screen has to be the number being enforced. A plan change
   * moves the limit without touching a row, so reading it from the entitlement
   * rather than from anything stored is what keeps the two together.
   */
  it.layer(as("usage_pro", "owner", "pro"))("a paid organization", (it) => {
    it.effect("reports its own plan's limits, not the free ones", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seed("usage_pro", { members: 1, keys: 0, bytes: 0 });

        expect(rowFor(yield* client.GetUsage(), "seats")).toMatchObject({
          allowed: limits.pro.seats,
        });
      }));
  });

  /** A member may not read the bill, so they may not read what it buys either. */
  it.layer(as("usage_member", "member", "free"))("a member", (it) => {
    it.effect("is refused", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seed("usage_member", { members: 1, keys: 0, bytes: 0 });

        expect(yield* Effect.flip(client.GetUsage())).toMatchObject({ _tag: "Forbidden" });
      }));
  });
});
