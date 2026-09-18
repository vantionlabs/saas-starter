import { Effect } from "effect";
import { CurrentUser } from "../identity/Identity.js";
import { permissionsFor } from "../identity/Permission.js";
import { IamRpcs } from "./IamRpc.js";

/**
 * `CurrentUser` is a service key, and in v4 a service key *is* an
 * `Effect<Identity, never, CurrentUser>` — so the handler is the key itself,
 * with no conversion step.
 */
export const IamRpcLive = IamRpcs.toLayer(
  Effect.sync(() =>
    IamRpcs.of({
      Me: () => CurrentUser,

      MyPermissions: () =>
        Effect.map(CurrentUser, (identity) => Array.from(permissionsFor(identity.role))),
    })
  ),
);
