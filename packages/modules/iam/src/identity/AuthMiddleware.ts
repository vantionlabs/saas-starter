import { RpcMiddleware } from "effect/unstable/rpc";
import { CurrentEntitlement } from "./Entitlement.js";
import { CurrentUser, Unauthenticated } from "./Identity.js";

/**
 * Applied to every authenticated RPC group. Resolves the session from request
 * headers and provides the handlers beneath it both facts they authorise
 * against: who the caller is, and what their organization has paid for.
 *
 * Both come from here rather than being looked up per policy, so a handler
 * guarded by a permission *and* a feature costs one resolution rather than two.
 */
export class AuthMiddleware extends RpcMiddleware.Service<AuthMiddleware, {
  provides: CurrentUser | CurrentEntitlement;
}>()("AuthMiddleware", {
  error: Unauthenticated,
}) {}
