import { Layer } from "effect";
import { AccessRpcLive } from "./access/AccessRpcLive.js";
import { PermissionResolver } from "./access/PermissionResolver.js";
import { ApiKeyAuth } from "./apikey/ApiKeyAuth.js";
import { AuditLog } from "./audit/AuditLog.js";
import { Auth } from "./auth/Auth.js";
import { AuthHttp } from "./auth/AuthHttp.js";
import { AuthMiddlewareLive } from "./auth/AuthMiddlewareLive.js";
import { OrganizationRpcLive } from "./organization/OrganizationRpcLive.js";
import { IamRpcLive } from "./session/IamRpcLive.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * An application composes modules rather than their parts: without this, adding
 * a handler here means editing `Main.ts` there, and the two drift until some
 * procedure is declared in `AppRpcs` and served by nothing.
 *
 * `provideMerge` rather than `provide` for the services — they are wired into
 * this module's own handlers *and* re-exported, because callers outside it need
 * them too. The public API authenticates with `ApiKeyAuth`, and `withOrgScope`
 * anywhere in the process reads the `CurrentUser` that `AuthMiddlewareLive`
 * resolved.
 *
 * What is left in the requirements is deliberate: `SqlClient`, `Mailer`,
 * `RateLimiter` and the rest are the host's to provide, not this module's to
 * assume. That is what lets the same layer serve an HTTP API, an MCP server or
 * a worker without knowing which it is in.
 *
 * Registering it in more than one place is fine and expected — Effect memoises
 * a layer by reference, so naming it both where the RPC server needs handlers
 * and where the public API needs services builds it exactly once.
 */
export const IamModule = Layer.mergeAll(
  IamRpcLive,
  OrganizationRpcLive,
  AccessRpcLive,
).pipe(
  Layer.provideMerge(AuthMiddlewareLive),
  Layer.provideMerge(ApiKeyAuth.layer),
  Layer.provideMerge(AuditLog.layer),
  Layer.provideMerge(PermissionResolver.layer),
  Layer.provideMerge(Auth.layer),
);

/**
 * The module's own HTTP routes, separate from `IamModule` because they mount
 * somewhere else.
 *
 * A route layer requires the `HttpRouter` it adds itself to, and that service
 * only exists inside `HttpRouter.serve`. Folding these into `IamModule` would
 * make the whole module unprovidable anywhere the router is not already open —
 * which is to say, in an MCP server or a worker. Register this one in the route
 * set; register `IamModule` everywhere.
 */
export const IamHttp = AuthHttp;
