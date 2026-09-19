import { AdminRpcs } from "./AdminRpc.js";
import { listStaffTrail } from "./StaffTrail.js";

/** The RPC transport over `listStaffTrail`, and nothing else. */
export const ListStaffTrail = AdminRpcs.toLayerHandler(
  "ListStaffTrail",
  (payload) => listStaffTrail(payload.limit),
);
