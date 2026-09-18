import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import { Effect, Layer, Option } from "effect";
import { fromPriceMetadata } from "./Plan.js";
import {
  StripeClient,
  StripeUnavailable,
  SubscriptionEvent,
  WebhookRejected,
} from "./StripeClient.js";

/**
 * The live client.
 *
 * In its own file, imported dynamically by `StripeClient.layer`, so a process
 * with no `STRIPE_SECRET_KEY` never loads the SDK — and so the tests for the
 * webhook's write logic need no Stripe at all.
 */
export const layerStripe = (options: {
  readonly apiKey: string;
  readonly webhookSecret: string;
}): Layer.Layer<StripeClient> =>
  Layer.effect(StripeClient)(
    Effect.gen(function*() {
      const { default: Stripe } = yield* Effect.promise(() => import("stripe"));
      const stripe = new Stripe(options.apiKey);

      /**
       * The price for a plan, found by its metadata rather than a hard-coded id.
       *
       * Price ids differ between every sandbox and every account, so hard-coding
       * one makes the build wrong everywhere except the account it was written
       * on. Metadata is a dashboard change; an id is a deploy.
       */
      const priceFor = (plan: Plan) =>
        Effect.tryPromise({
          try: () => stripe.prices.list({ active: true, limit: 100 }),
          catch: () => new StripeUnavailable({ reason: "Unreachable" }),
        }).pipe(
          Effect.flatMap((prices) => {
            const match = prices.data.find((price) =>
              fromPriceMetadata(price.metadata as Record<string, string>) === plan
            );

            return match === undefined
              ? Effect.fail(new StripeUnavailable({ reason: "Rejected" }))
              : Effect.succeed(match.id);
          }),
        );

      return {
        configured: true,

        checkout: (request) =>
          Effect.gen(function*() {
            const price = yield* priceFor(request.plan);

            const session = yield* Effect.tryPromise({
              try: () =>
                stripe.checkout.sessions.create({
                  mode: "subscription",
                  line_items: [{ price, quantity: 1 }],
                  success_url: request.successUrl,
                  cancel_url: request.cancelUrl,
                  // The organization is carried on the subscription rather than
                  // only on the session, because the webhook that matters arrives
                  // later and does not mention the session.
                  subscription_data: { metadata: { organizationId: request.organizationId } },
                  client_reference_id: request.organizationId,
                }),
              catch: () => new StripeUnavailable({ reason: "Unreachable" }),
            });

            return session.url === null
              ? yield* new StripeUnavailable({ reason: "Rejected" })
              : { url: session.url };
          }),

        portal: (request) =>
          Effect.tryPromise({
            try: () =>
              stripe.billingPortal.sessions.create({
                customer: request.customerId,
                return_url: request.returnUrl,
              }),
            catch: () => new StripeUnavailable({ reason: "Unreachable" }),
          }).pipe(Effect.map((session) => ({ url: session.url }))),

        event: (request) =>
          Effect.gen(function*() {
            const event = yield* Effect.tryPromise({
              try: () =>
                stripe.webhooks.constructEventAsync(
                  request.body,
                  request.signature,
                  options.webhookSecret,
                ),
              // Stripe throws the same way for a forged signature and a mangled
              // body, and telling them apart would mean parsing its message.
              catch: () => new WebhookRejected({ reason: "BadSignature" }),
            });

            // Everything else Stripe sends is something this application has no
            // opinion about, and acknowledging it is the correct response.
            if (!event.type.startsWith("customer.subscription.")) return Option.none();

            const subscription = event.data.object as {
              id: string;
              customer: string | { id: string; };
              status: string;
              metadata?: Record<string, string>;
              items: {
                data: ReadonlyArray<
                  { price: { metadata: Record<string, string>; }; quantity?: number; }
                >;
              };
            };

            const item = subscription.items.data[0];

            return Option.some(
              new SubscriptionEvent({
                id: event.id,
                type: event.type,
                created: event.created,
                customerId: typeof subscription.customer === "string"
                  ? subscription.customer
                  : subscription.customer.id,
                organizationId: subscription.metadata?.["organizationId"] ?? null,
                subscriptionId: subscription.id,
                plan: item === undefined
                  ? null
                  : fromPriceMetadata(item.price.metadata) ?? null,
                status: event.type === "customer.subscription.deleted"
                  ? "canceled"
                  : subscription.status,
                seats: item?.quantity ?? null,
              }),
            );
          }),
      };
    }),
  ).pipe(Layer.orDie);
