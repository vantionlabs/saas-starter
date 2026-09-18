import { CurrentUser } from "../identity/Identity.js";
import { IamRpcs } from "./IamRpc.js";

/**
 * `CurrentUser` is a service key, and in v4 a service key *is* an
 * `Effect<Identity, never, CurrentUser>` — so the handler is the key itself,
 * with no conversion step.
 */
export const Me = IamRpcs.toLayerHandler("Me", () => CurrentUser);
