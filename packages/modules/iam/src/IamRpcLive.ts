import { Effect } from "effect";
import { IamRpcs } from "./IamRpc.js";
import { CurrentUser } from "./Identity.js";
import { permissionsFor } from "./Permission.js";

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
