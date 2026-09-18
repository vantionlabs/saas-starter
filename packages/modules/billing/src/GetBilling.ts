import type { Plan, SubscriptionStatus } from "@vantion/module-iam/identity/Entitlement";
import { Entitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect, Option } from "effect";
import { BillingRpcs, BillingState } from "./BillingRpc.js";
import { currentSubscription } from "./CurrentSubscription.js";
import { StripeClient } from "./StripeClient.js";

/**
 * What the organization is paying for, and what it can do about it.
 *
 * The entitlement is rebuilt here from the row rather than read from
 * `CurrentEntitlement`, because the two answer different questions. The request
 * context holds what the caller is entitled to *now*; this screen also has to
 * show the lapsed subscription behind a downgrade, which is exactly the
 * information `effectivePlan` throws away.
 */
export const GetBilling = BillingRpcs.toLayerHandler("GetBilling", () =>
  Effect.gen(function*() {
    const stripe = yield* StripeClient;
    const row = yield* currentSubscription;

    const entitlement = Option.match(row, {
      onNone: () => free,
      onSome: (subscription) =>
        new Entitlement({
          // Both columns carry a check constraint, so the database cannot hold
          // anything the schema does not name.
          plan: subscription.plan as Plan,
          status: subscription.status as SubscriptionStatus,
          seats: subscription.seats,
        }),
    });

    return new BillingState({
      plan: entitlement.plan,
      effectivePlan: entitlement.effectivePlan,
      status: entitlement.status,
      seats: entitlement.seats,
      cancelAtPeriodEnd: Option.match(row, {
        onNone: () => false,
        onSome: (subscription) => subscription.cancelAtPeriodEnd,
      }),
      currentPeriodEnd: Option.match(row, {
        onNone: () => null,
        onSome: (subscription) => subscription.currentPeriodEnd?.toISOString() ?? null,
      }),
      configured: stripe.configured,
      manageable: Option.isSome(row),
    });
  }).pipe(withPolicy(permission("billing:read"))));
