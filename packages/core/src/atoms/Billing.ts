import type { PaidPlan } from "@vantion/module-billing/BillingRpc";
import { BillingState, UsageRow } from "@vantion/module-billing/BillingRpc";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { AppRpc } from "../AppRpc.js";
import { Keys } from "../Keys.js";

/** Rendered on the server; the key and schema are shared with its loader. */
export const billingSerial = {
  key: "billing",
  schema: AsyncResult.Schema({ success: BillingState }),
};

export const billingAtom = Atom.withReactivity([Keys.organization, Keys.billing])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("GetBilling", undefined);
    }),
  ),
).pipe(Atom.serializable(billingSerial));

/**
 * Rendered on the server, and invalidated by far more than billing is.
 *
 * Every key it counts belongs to something else — a member joining, a key being
 * revoked, a file uploaded — so the numbers go stale for reasons a billing
 * screen never hears about. Subscribing to all of them is what makes the count
 * beside a limit true rather than true when the page happened to load.
 */
export const usageSerial = {
  key: "usage",
  schema: AsyncResult.Schema({ success: Schema.Array(UsageRow) }),
};

export const usageAtom = Atom.withReactivity([
  Keys.organization,
  Keys.billing,
  Keys.members,
  Keys.apiKeys,
  Keys.files,
])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("GetUsage", undefined);
    }),
  ),
).pipe(Atom.serializable(usageSerial));

/**
 * Both of these return a URL rather than navigating, because Stripe's page is
 * not part of this application and the route that called them is what decides
 * how to leave. Neither invalidates anything: the subscription changes when
 * Stripe's webhook says so, which is minutes later and arrives while the
 * customer is still on Stripe's own page.
 */
export const checkoutAtom = AppRpc.runtime.fn<PaidPlan>()(
  (plan) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("StartCheckout", { plan });
    }),
);

export const billingPortalAtom = AppRpc.runtime.fn<void>()(
  () =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("OpenBillingPortal", undefined);
    }),
);
