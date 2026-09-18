import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs } from "./AccessRpc.js";

export const DeleteRole = AccessRpcs.toLayerHandler(
  "DeleteRole",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    yield* sql`delete from "organizationRole"
               where "organizationId" = ${orgId} and "role" = ${payload.role}`
      .pipe(Effect.orDie, withPolicy(permission("ac:delete")));
  }),
);
