import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs } from "./AccessRpc.js";

export const SetMemberOverride = AccessRpcs.toLayerHandler(
  "SetMemberOverride",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;
    const { memberId, permission: granted, granted: isGranted } = payload.override;

    yield* withOrgScope(sql`
      insert into "memberPermission"
        ("id", "organizationId", "memberId", "permission", "granted")
      values (${randomUUID()}, ${orgId}, ${memberId}, ${granted}, ${isGranted})
      on conflict ("memberId", "permission")
      do update set "granted" = ${isGranted}
    `).pipe(Effect.orDie, withPolicy(permission("ac:update")));
  }),
);
