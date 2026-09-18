import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { ContactRpcs, Overview } from "./ContactRpc.js";

/**
 * A dashboard concern rather than a contact one — it counts members and roles
 * too, and no public API asks for it. It lives here because the dashboard it
 * serves is the contacts screen; move it the day that stops being true.
 */
export const GetOverview = ContactRpcs.toLayerHandler("GetOverview", () =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    const contactCount = yield* withOrgScope(
      sql<{ count: string; }>`
        select count(*)::text as "count" from "contact" where "organizationId" = ${orgId}
      `,
    );
    const members = yield* sql<{ count: string; }>`
      select count(*)::text as "count" from "member" where "organizationId" = ${orgId}
    `;
    const roles = yield* sql<{ count: string; }>`
      select count(*)::text as "count" from "organizationRole"
      where "organizationId" = ${orgId}
    `;

    return new Overview({
      contacts: Number(contactCount[0]?.count ?? 0),
      members: Number(members[0]?.count ?? 0),
      customRoles: Number(roles[0]?.count ?? 0),
    });
  }).pipe(Effect.orDie, withPolicy(permission("contact:read"))));
