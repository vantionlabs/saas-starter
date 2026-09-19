import { AdminRpcs } from "./AdminRpc.js";
import { findPerson } from "./People.js";

/** The RPC transport over `findPerson`, and nothing else. */
export const FindPerson = AdminRpcs.toLayerHandler(
  "FindPerson",
  (payload) => findPerson(payload.email, payload.reason),
);
