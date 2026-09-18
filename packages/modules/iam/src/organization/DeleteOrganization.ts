import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { LastOrganization, NameMismatch, OrganizationRpcs } from "./OrganizationRpc.js";

/**
 * Deletes the organization and, by cascade, everything in it.
 *
 * Two things happen first. The caller must have somewhere else to land, or they
 * would be left signed in to nothing; and the name they typed must match, which
 * is what stops a destructive request prepared for one organization from being
 * replayed against another after a switch.
 *
 * Every session pointing at it is moved before the delete, so nobody else in the
 * organization is left holding a session that references a row that no longer
 * exists.
 */
export const DeleteOrganization = OrganizationRpcs.toLayerHandler(
  "DeleteOrganization",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;

    return yield* Effect.gen(function*() {
      const rows = yield* sql<{ name: string; }>`
        select "name" from "organization" where "id" = ${identity.orgId}
      `.pipe(Effect.orDie);

      const organization = rows[0];
      if (organization === undefined) return;

      if (organization.name !== payload.confirmName) {
        return yield* new NameMismatch({ orgId: identity.orgId });
      }

      const others = yield* sql<{ organizationId: string; }>`
        select "organizationId" from "member"
        where "userId" = ${identity.userId} and "organizationId" <> ${identity.orgId}
        order by "createdAt" asc limit 1
      `.pipe(Effect.orDie);

      const fallback = others[0];
      if (fallback === undefined) {
        return yield* new LastOrganization({ orgId: identity.orgId });
      }

      yield* sql.withTransaction(
        Effect.gen(function*() {
          // Move everybody's session out before the row disappears.
          yield* sql`
            update "session" set "activeOrganizationId" = null
            where "activeOrganizationId" = ${identity.orgId}
          `;
          yield* sql`
            update "session" set "activeOrganizationId" = ${fallback.organizationId}
            where "userId" = ${identity.userId}
          `;
          yield* sql`delete from "organization" where "id" = ${identity.orgId}`;
        }),
      ).pipe(Effect.orDie);
    }).pipe(withPolicy(permission("organization:delete")));
  }),
);
