import { OrganizationRpcLive } from "@/organization/OrganizationRpcLive.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, Entitlement, limits } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { OrganizationRpcs } from "@vantion/module-iam/organization/OrganizationRpc";
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

const as = (org: string, role: string, plan: "free" | "pro") =>
  OrganizationRpcLive.pipe(
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
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

const seedOrg = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
});

/**
 * The limit that was declared and never checked.
 *
 * A plan promising two keys and issuing a third is worse than one with no
 * limit at all: the number is on the pricing page, on the usage screen, and in
 * the entitlement, and every one of them was a guess about behaviour nothing
 * enforced.
 */
describe.skipIf(testDbUrl() === undefined)("the API key limit", () => {
  it.layer(as("keylimit_free", "owner", "free"))("on the free plan", (it) => {
    it.effect("refuses the key past the allowance, naming the number", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(OrganizationRpcs);
        const allowed = limits.free.apiKeys;

        yield* seedOrg("keylimit_free");

        for (let n = 0; n < allowed; n += 1) {
          yield* client.CreateApiKey({ name: `key ${n}`, role: "member" });
        }

        /**
         * `allowed` comes back with the refusal, because a caller cannot say
         * anything useful about a quota without the number — "you have reached
         * the limit" is a sentence somebody has to leave the page to act on.
         */
        expect(yield* Effect.flip(client.CreateApiKey({ name: "one too many", role: "member" })))
          .toMatchObject({ _tag: "LimitReached", limit: "apiKeys", allowed });

        // And the refusal is a refusal: nothing was written on the way out.
        expect((yield* client.ListApiKeys()).length).toBe(allowed);
      }));
  });

  /**
   * Who you are is settled before anything about the plan is. Asked the other
   * way round, somebody with no right to create a key would be told how many
   * the organization has left — a fact about the tenant handed to a caller who
   * may not act on it.
   */
  it.layer(as("keylimit_member", "member", "free"))("for somebody who may not", (it) => {
    it.effect("refuses on the permission, not on the limit", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(OrganizationRpcs);

        yield* seedOrg("keylimit_member");

        expect(yield* Effect.flip(client.CreateApiKey({ name: "nope", role: "member" })))
          .toMatchObject({ _tag: "Forbidden" });
      }));
  });
});
