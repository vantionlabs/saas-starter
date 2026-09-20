import { EndpointId, WebhooksRpcs } from "@/WebhooksRpc.js";
import { WebhooksRpcLive } from "@/WebhooksRpcLive.js";
import { describe, expect, it } from "@effect/vitest";
import { withWorkerScope } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, Entitlement, limits } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer } from "effect";
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

const as = (org: string, role: string, plan: "free" | "scale") =>
  WebhooksRpcLive.pipe(
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

/** A delivery row, written the way the worker writes one. */
const seedDelivery = Effect.fnUntraced(function*(org: string, endpointId: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* withWorkerScope(sql`
    insert into "webhookDelivery"
      ("id", "organizationId", "endpointId", "eventId", "kind", "status", "attempts",
       "responseStatus", "lastError")
    values (
      ${randomUUID()}, ${org}, ${endpointId}, ${randomUUID()}, 'contact.created',
      'failed', 3, 500, 'Internal Server Error'
    )
  `);
});

describe.skipIf(testDbUrl() === undefined)("WebhooksRpcLive", () => {
  it.layer(as("wh_scale", "owner", "scale"))("an entitled organization", (it) => {
    it.effect("registers an endpoint and hands back the secret once", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_scale");

        const created = yield* client.RegisterEndpoint({ url: "https://hooks.acme.test/a" });

        expect(created.secret.startsWith("whsec_")).toBe(true);

        /**
         * And it is the *only* time. The list narrows its select, so the
         * signing secret never reaches a screen — or the dehydrated state a
         * screen is serialised into.
         */
        const [endpoint] = yield* client.ListEndpoints();

        expect(endpoint?.url).toBe("https://hooks.acme.test/a");
        expect(JSON.stringify(endpoint)).not.toContain("whsec_");
      }));

    it.effect("rotates a secret and keeps the endpoint", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_scale");
        const created = yield* client.RegisterEndpoint({ url: "https://hooks.acme.test/b" });

        const rotated = yield* client.RotateSecret({ id: created.id });

        expect(rotated.secret).not.toBe(created.secret);
        expect(rotated.id).toBe(created.id);
      }));

    it.effect("says so when there is nothing to rotate", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_scale");

        expect(
          yield* Effect.flip(client.RotateSecret({ id: EndpointId.make(randomUUID()) })),
        ).toMatchObject({ _tag: "EndpointNotFound" });
      }));

    it.effect("removes an endpoint, and the attempts recorded against it", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_scale");
        const created = yield* client.RegisterEndpoint({ url: "https://hooks.acme.test/c" });
        yield* seedDelivery("wh_scale", created.id);

        expect((yield* client.ListDeliveries()).length).toBeGreaterThan(0);

        yield* client.DeleteEndpoint({ id: created.id });

        /**
         * The cascade, asserted rather than assumed — it is the reason
         * rotating exists as its own act instead of being "remove and add".
         */
        expect((yield* client.ListDeliveries()).length).toBe(0);
      }));

    it.effect("shows what was attempted, with the response and the error", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_scale");
        const created = yield* client.RegisterEndpoint({ url: "https://hooks.acme.test/d" });
        yield* seedDelivery("wh_scale", created.id);

        const [delivery] = yield* client.ListDeliveries();

        expect(delivery).toMatchObject({
          kind: "contact.created",
          status: "failed",
          attempts: 3,
          responseStatus: 500,
        });
      }));
  });

  /**
   * The plan gates *adding* and nothing else. An organization that downgraded
   * still needs to see why deliveries stopped, and still needs to be able to
   * rotate a secret it believes has leaked — taking that away would make a
   * lapsed plan a security problem.
   */
  it.layer(as("wh_free", "owner", "free"))("an organization without the feature", (it) => {
    it.effect("cannot add an endpoint", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_free");

        expect(yield* Effect.flip(client.RegisterEndpoint({ url: "https://hooks.acme.test/e" })))
          .toMatchObject({ _tag: "Forbidden" });
      }));

    it.effect("can still read the ones it has", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_free");

        expect(yield* client.ListEndpoints()).toEqual([]);
      }));
  });

  /** A signing secret is a credential, so a member may not go near one. */
  it.layer(as("wh_member", "member", "scale"))("a member", (it) => {
    it.effect("is refused the list", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(WebhooksRpcs);

        yield* seedOrg("wh_member");

        expect(yield* Effect.flip(client.ListEndpoints()))
          .toMatchObject({ _tag: "Forbidden" });
      }));
  });
});
