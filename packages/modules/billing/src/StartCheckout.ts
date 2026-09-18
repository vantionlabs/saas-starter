import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Config, Effect } from "effect";
import { BillingRpcs, BillingSession } from "./BillingRpc.js";
import { StripeClient } from "./StripeClient.js";

/**
 * Where Stripe sends the browser back to.
 *
 * Built from `WEB_URL` on the server, never from the payload. A return address
 * a client chooses is an open redirect, and this one sits behind a payment page
 * — the most attractive possible place to be sent somewhere else.
 */
const returnUrls = Effect.map(
  Config.nonEmptyString("WEB_URL"),
  (webUrl) => ({
    successUrl: `${webUrl.replace(/\/$/, "")}/settings/billing?checkout=done`,
    cancelUrl: `${webUrl.replace(/\/$/, "")}/settings/billing?checkout=cancelled`,
  }),
);

export const StartCheckout = BillingRpcs.toLayerHandler(
  "StartCheckout",
  (payload) =>
    Effect.gen(function*() {
      const stripe = yield* StripeClient;
      const { orgId } = yield* CurrentUser;
      const urls = yield* returnUrls.pipe(Effect.orDie);

      const session = yield* stripe.checkout({
        organizationId: orgId,
        plan: payload.plan,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
      });

      return new BillingSession({ url: session.url });
    }).pipe(withPolicy(permission("billing:manage"))),
);
