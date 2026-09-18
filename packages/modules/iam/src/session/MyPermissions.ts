import { Effect } from "effect";
import { CurrentUser } from "../identity/Identity.js";
import { permissionsFor } from "../identity/Permission.js";
import { IamRpcs } from "./IamRpc.js";

export const MyPermissions = IamRpcs.toLayerHandler(
  "MyPermissions",
  () => Effect.map(CurrentUser, (identity) => Array.from(permissionsFor(identity.role))),
);
