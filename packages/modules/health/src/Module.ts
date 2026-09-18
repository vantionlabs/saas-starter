import { HealthHttp } from "./HealthHttp.js";
import { HealthRpcLive } from "./HealthRpcLive.js";

/** Everything this module implements, as one layer to register. */
export const HealthModule = HealthRpcLive;

/**
 * `GET /health` and `GET /ready`, separate for the same reason every module's
 * routes are: a route layer requires the `HttpRouter` it adds itself to.
 */
export const HealthHttpRoutes = HealthHttp;
