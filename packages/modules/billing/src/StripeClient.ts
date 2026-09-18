import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import type { SubscriptionStatus } from "@vantion/module-iam/identity/Entitlement";
import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";

/**
 * What a Stripe webhook tells us, narrowed at the boundary.
 *
 * Deliberately not Stripe's own event type. The SDK's shape is enormous, changes
 * with its versions, and carries a hundred fields nothing here reads — passing it
 * inward would make every consumer depend on a vendor's release notes.
 */
export class SubscriptionEvent extends Schema.Class<SubscriptionEvent>("SubscriptionEvent")({
  /** Stripe's event id. The idempotency key. */
  id: Schema.String,
  type: Schema.String,
  /** Stripe's own timestamp, in seconds. What orders two events. */
  created: Schema.Number,
  customerId: Schema.String,
  /**
   * Set by checkout, on the subscription's own metadata.
   *
   * It is how the first event for a customer finds its organization — before
   * that there is no row to look one up from. Later events carry it too and are
   * matched by customer id, which is why it is nullable rather than required.
   */
  organizationId: Schema.NullOr(Schema.String),
  subscriptionId: Schema.NullOr(Schema.String),
  plan: Schema.NullOr(Schema.String),
  status: Schema.NullOr(Schema.String),
  seats: Schema.NullOr(Schema.Number),
}) {}

/** Stripe is unreachable, or refused. Both mean "try again", not "give up". */
export class StripeUnavailable
  extends Schema.TaggedError<StripeUnavailable>()("StripeUnavailable", {
    reason: Schema.Literals(["Unreachable", "Rejected"]),
  })
{}

/** A webhook that did not come from Stripe, or did not survive the journey. */
export class WebhookRejected extends Schema.TaggedError<WebhookRejected>()("WebhookRejected", {
  reason: Schema.Literals(["BadSignature", "Unreadable"]),
}) {}

export interface StripeClientService {
  /** Where to send someone to start paying. */
  readonly checkout: (options: {
    readonly organizationId: string;
    readonly plan: Plan;
    readonly successUrl: string;
    readonly cancelUrl: string;
  }) => Effect.Effect<{ readonly url: string; }, StripeUnavailable>;

  /** Where to send someone to change a card or cancel. */
  readonly portal: (options: {
    readonly customerId: string;
    readonly returnUrl: string;
  }) => Effect.Effect<{ readonly url: string; }, StripeUnavailable>;

  /**
   * Verifies a webhook and narrows it, or says why it will not.
   *
   * Verification belongs here rather than in the route because it needs the
   * signing secret, and the route should not be a place secrets are read.
   */
  readonly event: (options: {
    readonly body: string;
    readonly signature: string;
  }) => Effect.Effect<Option.Option<SubscriptionEvent>, WebhookRejected>;
}

export class StripeClient extends Context.Service<StripeClient, StripeClientService>()(
  "StripeClient",
) {
  /**
   * Refuses every call, loudly, and accepts no webhook.
   *
   * The layer for a process with no Stripe account — which is every fresh clone
   * and every test. It does not pretend to succeed: a checkout that returned a
   * fake URL would send somebody to a page that does not exist, and that is a
   * worse failure than being told billing is not configured.
   */
  static layerUnconfigured: Layer.Layer<StripeClient> = Layer.succeed(StripeClient)({
    checkout: () => Effect.fail(new StripeUnavailable({ reason: "Rejected" })),
    portal: () => Effect.fail(new StripeUnavailable({ reason: "Rejected" })),
    event: () => Effect.fail(new WebhookRejected({ reason: "BadSignature" })),
  });

  /**
   * Stripe when `STRIPE_SECRET_KEY` is set, refusal when it is not.
   *
   * Read from the environment rather than from `NODE_ENV`, like every other
   * boundary here, so a deployment that forgets the key fails at the checkout
   * button rather than at boot.
   */
  static layer: Layer.Layer<StripeClient> = Layer.unwrap(
    Effect.gen(function*() {
      const key = yield* Config.option(Config.redacted("STRIPE_SECRET_KEY"));

      if (Option.isNone(key) || Redacted.value(key.value).trim() === "") {
        return StripeClient.layerUnconfigured;
      }

      const secret = yield* Config.redacted("STRIPE_WEBHOOK_SECRET");
      const { layerStripe } = yield* Effect.promise(() => import("./Stripe.js"));

      return layerStripe({
        apiKey: Redacted.value(key.value),
        webhookSecret: Redacted.value(secret),
      });
    }).pipe(Effect.orDie),
  );
}

/** Normalises Stripe's status strings, defaulting to something safe. */
export const asStatus = (status: string | null): SubscriptionStatus => {
  const known: ReadonlyArray<SubscriptionStatus> = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
  ];

  // `unpaid`, `paused` and anything Stripe adds later land here. Treating an
  // unrecognised status as canceled withholds paid features rather than granting
  // them, which is the safe direction to be wrong in.
  return known.find((candidate) => candidate === status) ?? "canceled";
};
