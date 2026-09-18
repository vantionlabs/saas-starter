import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs } from "./AccessRpc.js";

export const ClearMemberOverride = AccessRpcs.toLayerHandler(
  "ClearMemberOverride",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;

    yield* withOrgScope(sql`
      delete from "memberPermission"
      where "memberId" = ${payload.memberId} and "permission" = ${payload.permission}
    `).pipe(Effect.orDie, withPolicy(permission("ac:update")));
  }),
);
