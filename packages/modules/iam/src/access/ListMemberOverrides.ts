import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { withOrgScope } from "../identity/OrgScope.js";
import type { Permission } from "../identity/Permission.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs, MemberOverride } from "./AccessRpc.js";

export const ListMemberOverrides = AccessRpcs.toLayerHandler(
  "ListMemberOverrides",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;

    const rows = yield* withOrgScope(sql<{ permission: string; granted: boolean; }>`
      select "permission", "granted" from "memberPermission"
      where "memberId" = ${payload.memberId} order by "permission" asc
    `).pipe(Effect.orDie, withPolicy(permission("ac:read")));

    return rows.map((row) =>
      new MemberOverride({
        memberId: payload.memberId,
        permission: row.permission as Permission,
        granted: row.granted,
      })
    );
  }),
);
