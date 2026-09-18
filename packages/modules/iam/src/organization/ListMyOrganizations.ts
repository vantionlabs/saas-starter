import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser, OrgId } from "../identity/Identity.js";
import { Membership, OrganizationRpcs } from "./OrganizationRpc.js";

/**
 * Scoped by membership rather than by the active org, so the switcher can see
 * the organizations the caller is *not* currently in.
 */
export const ListMyOrganizations = OrganizationRpcs.toLayerHandler(
  "ListMyOrganizations",
  () =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const identity = yield* CurrentUser;

      const rows = yield* sql<{ orgId: string; name: string; slug: string; role: string; }>`
      select o."id" as "orgId", o."name", o."slug", m."role"
      from "member" m join "organization" o on o."id" = m."organizationId"
      where m."userId" = ${identity.userId}
      order by o."name" asc
    `;

      return rows.map((row) =>
        new Membership({
          orgId: OrgId.make(row.orgId),
          name: row.name,
          slug: row.slug,
          role: row.role,
          isActive: row.orgId === identity.orgId,
        })
      );
    }).pipe(Effect.orDie),
);
