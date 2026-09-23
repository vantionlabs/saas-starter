import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Config, Effect, Option } from "effect";
import { BillingRpcs, BillingSession, NotSubscribed } from "./BillingRpc.js";
import { currentSubscription } from "./CurrentSubscription.js";
import { StripeClient } from "./StripeClient.js";

/**
 * Stripe's hosted portal: change a card, change a plan, cancel.
 *
 * Everything a customer can do to their own subscription happens there rather
 * than here, which is the point — the alternative is rebuilding dunning, proration
 * and tax handling in a settings screen.
 *
 * An organization that has never paid has no customer to send anywhere, and
 * `NotSubscribed` says so rather than inventing one. Creating a customer record
 * for somebody who only clicked "manage" would leave Stripe full of accounts
 * that never bought anything.
 */
export const OpenBillingPortal = BillingRpcs.toLayerHandler(
  "OpenBillingPortal",
  () =>
    Effect.gen(function*() {
      const stripe = yield* StripeClient;
      const row = yield* currentSubscription;

      if (Option.isNone(row)) return yield* new NotSubscribed();

      const webUrl = yield* Config.NonEmptyString("WEB_URL").pipe(Effect.orDie);

      const session = yield* stripe.portal({
        customerId: row.value.stripeCustomerId,
        returnUrl: `${webUrl.replace(/\/$/, "")}/settings/billing`,
      });

      return new BillingSession({ url: session.url });
    }).pipe(withPolicy(permission("billing:manage"))),
);
