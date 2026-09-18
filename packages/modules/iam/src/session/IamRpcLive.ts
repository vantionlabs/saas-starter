import { Layer } from "effect";
import { Me } from "./Me.js";
import { MyPermissions } from "./MyPermissions.js";

/** Who the caller is, and what they may do. */
export const IamRpcLive = Layer.mergeAll(Me, MyPermissions);
