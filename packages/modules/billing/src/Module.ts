import { Layer } from "effect";
import { BillingRpcLive } from "./BillingRpcLive.js";
import { StripeClient } from "./StripeClient.js";
import { StripeWebhook } from "./StripeWebhook.js";
import { layerDatabase } from "./Subscriptions.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * Registering it is the whole of turning billing on: it replaces
 * `EntitlementResolver.layerFree` in the application's graph, and every
 * `feature()` policy in the codebase starts reading real subscriptions without
 * a line changing anywhere else.
 */
export const BillingModule = Layer.mergeAll(layerDatabase, BillingRpcLive).pipe(
  Layer.provideMerge(StripeClient.layer),
);

/**
 * Stripe's webhook endpoint, separate for the reason every module's routes are:
 * a route layer requires the `HttpRouter` it adds itself to, and that service
 * only exists inside `HttpRouter.serve`.
 */
export const BillingHttp = StripeWebhook;
