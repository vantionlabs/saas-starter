import { SubscriptionEvent } from "@/StripeClient.js";
import { layerDatabase } from "@/Subscriptions.js";
import { apply } from "@/Webhook.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { EntitlementResolver } from "@vantion/module-iam/identity/EntitlementResolver";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

const ORG = "org_billing";
const CUSTOMER = "cus_test_billing";

const caller = { organizationId: ORG, userId: "user_billing" };

const event = (overrides: Partial<ConstructorParameters<typeof SubscriptionEvent>[0]>) =>
  new SubscriptionEvent({
    id: "evt_1",
    type: "customer.subscription.updated",
    created: 1_758_196_800,
    customerId: CUSTOMER,
    organizationId: ORG,
    subscriptionId: "sub_1",
    plan: "pro",
    status: "active",
    seats: 25,
    ...overrides,
  });

const live = layerDatabase.pipe(Layer.provideMerge(PgLive), Layer.provideMerge(PgPoolTest));

const reset = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${ORG}, ${ORG}, ${ORG}, now()) on conflict ("id") do nothing`;
  yield* sql`delete from "subscription" where "organizationId" = ${ORG}`;
  yield* sql`delete from "stripeEvent" where "id" like 'evt_%'`;
});

const stored = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<
    { plan: string; status: string; seats: number; lastEventCreated: string; }
  >`
    select "plan", "status", "seats", "lastEventCreated" from "subscription"
    where "organizationId" = ${ORG}
  `;

  return rows[0];
});

describe.skipIf(testDbUrl() === undefined)("stripe webhooks", () => {
  it.layer(live)("applying", (it) => {
    it.effect("creates the subscription from the organization checkout put on it", () =>
      Effect.gen(function*() {
        yield* reset();

        expect(yield* apply(event({}))).toBe("written");
        expect((yield* stored())?.plan).toBe("pro");
        expect((yield* stored())?.seats).toBe(25);
      }));

    /**
     * Stripe redelivers. Without the ledger the second copy would be applied
     * again, which for an upgrade is harmless and for a cancellation is not.
     */
    it.effect("ignores an event it has already seen", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* apply(event({}));

        const again = yield* apply(event({ plan: "free", status: "canceled" }));

        expect(again).toBe("duplicate");
        expect((yield* stored())?.plan).toBe("pro");
      }));

    /**
     * The one that bites in production. Stripe does not guarantee order, so a
     * `canceled` delivered after the `active` that superseded it would otherwise
     * cancel a live subscription.
     */
    it.effect("drops an event older than the state it is looking at", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* apply(event({ id: "evt_new", created: 2_000, plan: "scale" }));

        const late = yield* apply(
          event({ id: "evt_old", created: 1_000, plan: "free", status: "canceled" }),
        );

        expect(late).toBe("stale");
        expect((yield* stored())?.plan).toBe("scale");
      }));

    it.effect("applies a newer event", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* apply(event({ id: "evt_first", created: 1_000, plan: "pro" }));

        expect(yield* apply(event({ id: "evt_second", created: 2_000, plan: "scale" })))
          .toBe("written");
        expect((yield* stored())?.plan).toBe("scale");
      }));

    /**
     * Guessing would mean writing somebody else's plan onto an organization, so
     * an event that cannot be placed is acknowledged and dropped instead.
     */
    it.effect("refuses an event it cannot place", () =>
      Effect.gen(function*() {
        yield* reset();

        const orphan = yield* apply(
          event({ id: "evt_orphan", customerId: "cus_unknown", organizationId: null }),
        );

        expect(orphan).toBe("unplaceable");
        expect(yield* stored()).toBeUndefined();
      }));

    it.effect("matches later events by customer, without the metadata", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* apply(event({ id: "evt_a", created: 1_000 }));

        expect(
          yield* apply(
            event({ id: "evt_b", created: 2_000, organizationId: null, plan: "scale" }),
          ),
        ).toBe("written");
        expect((yield* stored())?.plan).toBe("scale");
      }));
  });

  it.layer(live)("what the session then reads", (it) => {
    /**
     * The whole loop, in one assertion: a Stripe event becomes a row, and the
     * row becomes the entitlement a `feature()` policy authorises against.
     */
    it.effect("turns into the entitlement the caller is authorised with", () =>
      Effect.gen(function*() {
        yield* reset();
        const resolver = yield* EntitlementResolver;

        expect((yield* resolver.resolve(caller)).effectivePlan).toBe("free");

        yield* apply(event({ id: "evt_loop", plan: "scale", seats: 250 }));

        const entitled = yield* resolver.resolve(caller);
        expect(entitled.effectivePlan).toBe("scale");
        expect(entitled.limits.seats).toBe(250);
      }));

    it.effect("falls back to free once the subscription is canceled", () =>
      Effect.gen(function*() {
        yield* reset();
        yield* apply(event({ id: "evt_live", created: 1_000, plan: "scale" }));
        yield* apply(event({ id: "evt_gone", created: 2_000, plan: "scale", status: "canceled" }));

        const resolver = yield* EntitlementResolver;

        expect((yield* resolver.resolve(caller)).effectivePlan).toBe("free");
      }));
  });
});
