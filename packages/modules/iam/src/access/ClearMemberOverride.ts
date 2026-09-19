import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs } from "./AccessRpc.js";
import { PermissionCache } from "./CachedPermissions.js";

/**
 * Drops one member's cached permissions.
 *
 * The role is part of the cache key — reassigning somebody must not reuse what
 * their old role left behind — so it has to be read back rather than assumed.
 */
const forgetMember = Effect.fnUntraced(function*(organizationId: string, memberId: string) {
  const sql = yield* SqlClient.SqlClient;
  const cache = yield* PermissionCache;

  const rows = yield* sql<{ role: string; }>`
    select "role" from "member"
    where "id" = ${memberId} and "organizationId" = ${organizationId}
  `.pipe(Effect.orDie);

  const role = rows[0]?.role;
  if (role !== undefined) yield* cache.invalidate({ organizationId, memberId, role });
});

export const ClearMemberOverride = AccessRpcs.toLayerHandler(
  "ClearMemberOverride",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    yield* withOrgScope(sql`
      delete from "memberPermission"
      where "memberId" = ${payload.memberId} and "permission" = ${payload.permission}
    `).pipe(Effect.orDie, withPolicy(permission("ac:update")));

    yield* forgetMember(orgId, payload.memberId);
  }),
);
