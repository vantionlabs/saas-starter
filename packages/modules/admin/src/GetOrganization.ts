import { AdminRpcs } from "./AdminRpc.js";
import { getOrganization } from "./Organizations.js";

/** The RPC transport over `getOrganization`, and nothing else. */
export const GetOrganization = AdminRpcs.toLayerHandler(
  "GetOrganization",
  (payload) => getOrganization(payload.organizationId, payload.reason),
);
