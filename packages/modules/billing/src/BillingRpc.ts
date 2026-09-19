import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { Plan, SubscriptionStatus } from "@vantion/module-iam/identity/Entitlement";
import { Forbidden } from "@vantion/module-iam/identity/Policy";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { StripeUnavailable } from "./BillingErrors.js";

/**
 * A plan somebody can check out to.
 *
 * `free` is missing deliberately: nobody buys it, and offering it as a checkout
 * target would mean a Stripe session for a price that need not exist. Leaving a
 * paid plan is the portal's job, not checkout's.
 */
export const PaidPlan = Schema.Literals(["pro", "scale"]);
export type PaidPlan = typeof PaidPlan.Type;

/**
 * The organization's billing state, as a settings page needs it.
 *
 * `plan` is what was bought and `effectivePlan` is what is switched on right
 * now; they differ exactly when a subscription has lapsed, and a screen that
 * showed only one of them would either lie about what was paid for or lie about
 * what works.
 */
export class BillingState extends Schema.Class<BillingState>("BillingState")({
  plan: Plan,
  effectivePlan: Plan,
  status: SubscriptionStatus,
  seats: Schema.Number,
  cancelAtPeriodEnd: Schema.Boolean,
  /** When the current period ends, if Stripe has told us. */
  currentPeriodEnd: Schema.NullOr(Schema.String),
  /**
   * Whether this deployment has Stripe credentials at all.
   *
   * A fresh clone has none, and a button that fails when pressed is worse than
   * a sentence explaining why there is no button. This is deployment
   * configuration rather than anything about the organization, which is why it
   * is safe to tell any member who may read billing.
   */
  configured: Schema.Boolean,
  /** Whether there is a Stripe customer to send to the portal. */
  manageable: Schema.Boolean,
}) {}

/** Where to send the browser. Always Stripe's own hosted page. */
export class BillingSession extends Schema.Class<BillingSession>("BillingSession")({
  url: Schema.String,
}) {}

/** The portal needs a customer, and an organization that never paid has none. */
export class NotSubscribed extends Schema.TaggedError<NotSubscribed>()("NotSubscribed", {}) {}

/**
 * One metered quantity, as a screen shows it.
 *
 * `used` and `allowed` in the **same unit**, carried on the row, rather than a
 * number whose meaning the reader has to know: seats are a count and storage is
 * bytes, and a table that mixed them silently would render a hundred megabytes
 * as a hundred files. The formatting is the screen's job; saying which unit it
 * is is the contract's.
 *
 * `allowed` travels with each row rather than the client looking it up from the
 * plan. The limit is enforced against the number the server holds, so that is
 * the number worth showing — a client computing its own from a plan table would
 * be free to disagree with the thing actually refusing the request.
 */
export const Metric = Schema.Literals(["seats", "apiKeys", "storage"]);
export type Metric = typeof Metric.Type;

export class UsageRow extends Schema.Class<UsageRow>("UsageRow")({
  metric: Metric,
  unit: Schema.Literals(["count", "bytes"]),
  used: Schema.Number,
  allowed: Schema.Number,
}) {}

export const BillingRpcs = RpcGroup.make(
  Rpc.make("GetBilling", { success: BillingState, error: Forbidden }),
  /**
   * What the organization is using against what it may.
   *
   * Separate from `GetBilling` because they answer different questions and one
   * is far more expensive: this counts rows in three tables, and the billing
   * panel is rendered on every visit to the settings screen while the numbers
   * are only wanted on one of them.
   */
  Rpc.make("GetUsage", { success: Schema.Array(UsageRow), error: Forbidden }),
  /**
   * Returns a Stripe Checkout URL rather than performing a redirect, because
   * the RPC transport is not the browser's navigation and the caller is the one
   * that knows how it wants to leave the page.
   *
   * Note what the payload does *not* carry: where to return to. Those URLs are
   * built on the server from `WEB_URL`, since a client-supplied return address
   * is an open redirect with a payment page in front of it.
   */
  Rpc.make("StartCheckout", {
    payload: { plan: PaidPlan },
    success: BillingSession,
    error: Schema.Union([Forbidden, StripeUnavailable]),
  }),
  /** Stripe's own billing portal: change a card, change a plan, cancel. */
  Rpc.make("OpenBillingPortal", {
    success: BillingSession,
    error: Schema.Union([Forbidden, StripeUnavailable, NotSubscribed]),
  }),
).middleware(AuthMiddleware);
