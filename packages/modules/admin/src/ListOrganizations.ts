import { AdminRpcs } from "./AdminRpc.js";
import { listOrganizations } from "./Organizations.js";

/** The RPC transport over `listOrganizations`, and nothing else. */
export const ListOrganizations = AdminRpcs.toLayerHandler(
  "ListOrganizations",
  (payload) => listOrganizations(payload.reason),
);
