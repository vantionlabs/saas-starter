import { layerDatabase } from "./Subscriptions.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * Registering it is the whole of turning billing on: it replaces
 * `EntitlementResolver.layerFree` in the application's graph, and every
 * `feature()` policy in the codebase starts reading real subscriptions without
 * a line changing anywhere else.
 */
export const BillingModule = layerDatabase;
