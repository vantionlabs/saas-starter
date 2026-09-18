import { Context, Schema } from "effect";

/**
 * What an organization is paying for.
 *
 * Deliberately not in `Permission.ts`. That object is also handed to
 * better-auth's access-control builder, and a plan is not a capability a person
 * has — it is a capability the *organization* has, and some of it is quantities
 * rather than booleans. Putting seats in there would give better-auth a
 * vocabulary it can never check.
 *
 * `Permission` answers "may this person"; `Entitlement` answers "may this
 * organization". `Policy.all` composes the two, and nothing new was needed to
 * make that work.
 */
export const Plan = Schema.Literals(["free", "pro", "scale"]);
export type Plan = typeof Plan.Type;

/** A capability a plan switches on. Booleans only — quantities are `limits`. */
export const Feature = Schema.Literals(["api_keys", "custom_roles", "webhooks"]);
export type Feature = typeof Feature.Type;

/**
 * Which plan carries which feature.
 *
 * The plans nest: everything `free` has, `pro` has, and so on. A test asserts
 * that, because the moment they stop nesting an upgrade can silently take
 * something away — which nobody discovers until a customer does.
 *
 * **This split is an example, and meant to be changed.** What it demonstrates is
 * that gating works and where it goes; which feature sits on which plan is a
 * pricing decision nobody else can make for you. `api_keys` is on `free` here
 * for one reason: a starter whose public API is switched off until somebody
 * wires up Stripe is a starter that looks broken on the first run.
 */
export const features: Record<Plan, ReadonlySet<Feature>> = {
  free: new Set<Feature>(["api_keys"]),
  pro: new Set<Feature>(["api_keys", "custom_roles"]),
  scale: new Set<Feature>(["api_keys", "custom_roles", "webhooks"]),
};

export type Limits = {
  /** Members who have accepted. A pending invitation is not a seat yet. */
  readonly seats: number;
  readonly apiKeys: number;
  readonly webhookEndpoints: number;
  /** Everything uploaded, in megabytes. Checked before a URL is signed. */
  readonly storageMb: number;
};

export const limits: Record<Plan, Limits> = {
  free: { seats: 3, apiKeys: 2, webhookEndpoints: 0, storageMb: 100 },
  pro: { seats: 25, apiKeys: 10, webhookEndpoints: 5, storageMb: 5_000 },
  scale: { seats: 250, apiKeys: 100, webhookEndpoints: 50, storageMb: 100_000 },
};

export const has = (plan: Plan, feature: Feature): boolean => features[plan].has(feature);

/**
 * Stripe's own vocabulary, kept rather than translated.
 *
 * `past_due` is deliberately still entitled: a card that failed this morning is
 * usually a card that will succeed this afternoon, and locking someone out of
 * the product they are trying to pay for is how a billing problem becomes a
 * churn problem.
 */
export const SubscriptionStatus = Schema.Literals([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);
export type SubscriptionStatus = typeof SubscriptionStatus.Type;

const ENTITLED: ReadonlySet<SubscriptionStatus> = new Set<SubscriptionStatus>([
  "trialing",
  "active",
  "past_due",
]);

/** What the caller's organization is entitled to, resolved once per request. */
export class Entitlement extends Schema.Class<Entitlement>("Entitlement")({
  plan: Plan,
  status: SubscriptionStatus,
  /** Seats paid for, which is not the same as seats used. */
  seats: Schema.Number,
}) {
  /**
   * An unpaid subscription falls back to `free` rather than to nothing.
   *
   * Removing access outright would take the audit trail and the export with it,
   * which is the data somebody needs precisely when they have stopped paying.
   */
  get effectivePlan(): Plan {
    return ENTITLED.has(this.status) ? this.plan : "free";
  }

  get limits(): Limits {
    return limits[this.effectivePlan];
  }
}

/** Every organization has one, whether or not it has ever paid. */
export const free = new Entitlement({ plan: "free", status: "active", seats: limits.free.seats });

/**
 * Resolved alongside `CurrentUser` and provided for the request.
 *
 * One lookup per request rather than one per policy: a handler guarded by both a
 * permission and a feature must not cost two round trips to find out it is
 * allowed.
 */
export class CurrentEntitlement
  extends Context.Service<CurrentEntitlement, Entitlement>()("CurrentEntitlement")
{}

/**
 * A quantity the plan caps has been reached.
 *
 * A feature being off needs no error of its own: `feature()` fails `Forbidden`
 * with `plan:<feature>` as the requirement, which every RPC contract already
 * declares and a client can already read. A *limit* is different — the caller
 * needs the number to say anything useful about it.
 */
export class LimitReached extends Schema.TaggedError<LimitReached>()("LimitReached", {
  limit: Schema.Literals(["seats", "apiKeys", "webhookEndpoints", "storageMb"]),
  allowed: Schema.Number,
}) {}
