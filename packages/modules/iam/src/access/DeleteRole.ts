import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs } from "./AccessRpc.js";
import { PermissionCache } from "./CachedPermissions.js";

/**
 * Drops the cached permissions of every member holding a role.
 *
 * A role's permissions belong to the role, and the cache is keyed per member —
 * so the members have to be named. One query on a write path, which is the
 * cheap side of the trade.
 */
const forgetRole = Effect.fnUntraced(function*(organizationId: string, role: string) {
  const sql = yield* SqlClient.SqlClient;
  const cache = yield* PermissionCache;

  const members = yield* sql<{ id: string; }>`
    select "id" from "member"
    where "organizationId" = ${organizationId} and "role" = ${role}
  `.pipe(Effect.orDie);

  for (const member of members) {
    yield* cache.invalidate({ organizationId, memberId: member.id, role });
  }
});

export const DeleteRole = AccessRpcs.toLayerHandler(
  "DeleteRole",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    yield* sql`delete from "organizationRole"
               where "organizationId" = ${orgId} and "role" = ${payload.role}`
      .pipe(Effect.orDie, withPolicy(permission("ac:delete")));

    yield* forgetRole(orgId, payload.role);
  }),
);
