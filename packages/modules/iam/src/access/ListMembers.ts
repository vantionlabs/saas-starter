import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs, OrganizationMember } from "./AccessRpc.js";

export const ListMembers = AccessRpcs.toLayerHandler("ListMembers", () =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    const rows = yield* sql<{ memberId: string; email: string; role: string; }>`
      select m."id" as "memberId", u."email" as "email", m."role" as "role"
      from "member" m join "user" u on u."id" = m."userId"
      where m."organizationId" = ${orgId} order by u."email" asc
    `.pipe(Effect.orDie);

    return rows.map((row) => new OrganizationMember(row));
  }).pipe(withPolicy(permission("member:read"))));
