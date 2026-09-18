import { StripeUnavailable } from "@/BillingErrors.js";
import { BillingRpcs } from "@/BillingRpc.js";
import { BillingRpcLive } from "@/BillingRpcLive.js";
import { StripeClient } from "@/StripeClient.js";
import { describe, expect, it } from "@effect/vitest";
import { withWorkerScope } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { ConfigProvider, Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

const WEB_URL = "https://app.example.test";

/** Every checkout and portal call the fake was asked to make, in order. */
const calls: Array<{ readonly kind: string; readonly request: Record<string, unknown>; }> = [];

/**
 * Stripe, configured, without Stripe.
 *
 * The port exists so this is possible: what these tests are about is which
 * caller may reach checkout and what we hand it, neither of which needs a
 * Stripe account to be worth asserting.
 */
const stripeFake: Layer.Layer<StripeClient> = Layer.succeed(StripeClient)({
  configured: true,
  checkout: (request) =>
    Effect.sync(() => {
      calls.push({ kind: "checkout", request });
      return { url: "https://checkout.stripe.test/session" };
    }),
  portal: (request) =>
    Effect.sync(() => {
      calls.push({ kind: "portal", request });
      return { url: "https://portal.stripe.test/session" };
    }),
  event: () => Effect.die("not used"),
});

const identity = (org: string, role: string) =>
  new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role,
    permissions: Array.from(permissionsFor(role)),
  });

const as = (org: string, role: string, stripe: Layer.Layer<StripeClient>) =>
  BillingRpcLive.pipe(
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(CurrentUser, identity(org, role)),
            // The plan is not what these tests are about: billing's own
            // procedures are gated on permissions, never on a feature — an
            // organization that cannot reach the upgrade page cannot upgrade.
            Effect.provideService(CurrentEntitlement, free),
          )
        ),
      ),
    ),
    Layer.provideMerge(stripe),
    Layer.provideMerge(
      ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEB_URL })),
    ),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

/** Tests run concurrently, so each block owns its organization outright. */
const seedOrg = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
});

/** Only the webhook writes here, so seeding one takes the worker's escape. */
const seedSubscription = Effect.fnUntraced(function*(
  org: string,
  row: { readonly plan: string; readonly status: string; readonly customer: string; },
) {
  const sql = yield* SqlClient.SqlClient;

  yield* withWorkerScope(sql`
    insert into "subscription"
      ("organizationId", "stripeCustomerId", "plan", "status", "seats", "currentPeriodEnd")
    values (${org}, ${row.customer}, ${row.plan}, ${row.status}, 25, '2026-12-01T00:00:00Z')
    on conflict ("organizationId") do update
      set "plan" = excluded."plan", "status" = excluded."status"
  `);
});

describe.skipIf(testDbUrl() === undefined)("BillingRpcLive", () => {
  it.layer(as("bill_none", "owner", StripeClient.layerUnconfigured))(
    "an organization that has never paid",
    (it) => {
      it.effect("is on the free plan, with nothing to manage", () =>
        Effect.gen(function*() {
          const client = yield* RpcTest.makeClient(BillingRpcs);

          yield* seedOrg("bill_none");

          const state = yield* client.GetBilling();

          expect(state.plan).toBe("free");
          expect(state.effectivePlan).toBe("free");
          expect(state.manageable).toBe(false);
          expect(state.currentPeriodEnd).toBeNull();
          // The deployment has no Stripe keys, and saying so is what lets the
          // screen explain itself instead of offering a button that fails.
          expect(state.configured).toBe(false);
        }));

      it.effect("has no customer to send to the portal", () =>
        Effect.gen(function*() {
          const client = yield* RpcTest.makeClient(BillingRpcs);

          yield* seedOrg("bill_none");

          expect(yield* Effect.flip(client.OpenBillingPortal())).toMatchObject({
            _tag: "NotSubscribed",
          });
        }));

      it.effect("cannot check out, because this deployment has no Stripe", () =>
        Effect.gen(function*() {
          const client = yield* RpcTest.makeClient(BillingRpcs);

          yield* seedOrg("bill_none");

          expect(yield* Effect.flip(client.StartCheckout({ plan: "pro" }))).toBeInstanceOf(
            StripeUnavailable,
          );
        }));
    },
  );

  it.layer(as("bill_paid", "owner", stripeFake))("a paying organization", (it) => {
    it.effect("reports the subscription it bought", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seedOrg("bill_paid");
        yield* seedSubscription("bill_paid", {
          plan: "pro",
          status: "active",
          customer: "cus_paid",
        });

        const state = yield* client.GetBilling();

        expect(state.plan).toBe("pro");
        expect(state.effectivePlan).toBe("pro");
        expect(state.seats).toBe(25);
        expect(state.manageable).toBe(true);
        expect(state.configured).toBe(true);
        expect(state.currentPeriodEnd).toContain("2026-12-01");
      }));

    it.effect("sends the portal the customer on its own row", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seedOrg("bill_paid");
        yield* seedSubscription("bill_paid", {
          plan: "pro",
          status: "active",
          customer: "cus_paid",
        });

        expect((yield* client.OpenBillingPortal()).url).toBe("https://portal.stripe.test/session");

        const portal = calls.filter((call) => call.kind === "portal").at(-1);
        expect(portal?.request["customerId"]).toBe("cus_paid");
        expect(portal?.request["returnUrl"]).toBe(`${WEB_URL}/settings/billing`);
      }));

    /**
     * The property worth protecting: a caller cannot choose where checkout
     * returns to. A client-supplied return address would be an open redirect
     * with a payment page in front of it.
     */
    it.effect("builds its return addresses from WEB_URL, not from the caller", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seedOrg("bill_paid");

        expect((yield* client.StartCheckout({ plan: "scale" })).url).toBe(
          "https://checkout.stripe.test/session",
        );

        const checkout = calls.filter((call) => call.kind === "checkout").at(-1);
        expect(checkout?.request["organizationId"]).toBe("bill_paid");
        expect(checkout?.request["plan"]).toBe("scale");
        expect(String(checkout?.request["successUrl"]).startsWith(WEB_URL)).toBe(true);
        expect(String(checkout?.request["cancelUrl"]).startsWith(WEB_URL)).toBe(true);
      }));
  });

  it.layer(as("bill_lapsed", "owner", stripeFake))("a lapsed subscription", (it) => {
    /**
     * Both plans are shown because they differ: what was bought is what the
     * portal will reinstate, and what is effective is what works today. A
     * screen showing only one of them lies about one or the other.
     */
    it.effect("keeps the plan it bought while falling back to free", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seedOrg("bill_lapsed");
        yield* seedSubscription("bill_lapsed", {
          plan: "scale",
          status: "canceled",
          customer: "cus_lapsed",
        });

        const state = yield* client.GetBilling();

        expect(state.plan).toBe("scale");
        expect(state.effectivePlan).toBe("free");
        expect(state.manageable).toBe(true);
      }));
  });

  it.layer(as("bill_admin", "admin", stripeFake))("an admin", (it) => {
    /**
     * The `free` here is also a tenancy assertion. Other blocks in this file
     * have paying subscriptions, and this organization has none — reading one
     * of theirs is the failure mode the read is written to prevent, and is what
     * this test caught when the query trusted row-level security alone.
     */
    it.effect("may see the bill but not change it", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seedOrg("bill_admin");

        expect((yield* client.GetBilling()).plan).toBe("free");

        expect(yield* Effect.flip(client.StartCheckout({ plan: "pro" }))).toMatchObject({
          _tag: "Forbidden",
          required: "billing:manage",
        });
      }));
  });

  it.layer(as("bill_member", "member", stripeFake))("a member", (it) => {
    it.effect("cannot see what the organization pays", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(BillingRpcs);

        yield* seedOrg("bill_member");

        expect(yield* Effect.flip(client.GetBilling())).toMatchObject({
          _tag: "Forbidden",
          required: "billing:read",
        });
      }));
  });
});
