import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { OrganizationRpcs } from "../organization/OrganizationRpc.js";
import { ApiKey } from "./ApiKey.js";

export const ListApiKeys = OrganizationRpcs.toLayerHandler(
  "ListApiKeys",
  () =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const identity = yield* CurrentUser;

      const rows = yield* withOrgScope(
        sql<{
          id: string;
          name: string;
          hint: string;
          role: string;
          createdAt: Date;
          lastUsedAt: Date | null;
        }>`
        select "id", "name", "hint", "role", "createdAt", "lastUsedAt"
        from "apiKey"
        where "organizationId" = ${identity.orgId}
        order by "createdAt" desc
      `,
      );

      return rows.map((row) =>
        new ApiKey({
          id: row.id,
          name: row.name,
          hint: row.hint,
          role: row.role,
          createdAt: DateTime.makeUnsafe(row.createdAt),
          lastUsedAt: row.lastUsedAt === null ? null : DateTime.makeUnsafe(row.lastUsedAt),
        })
      );
    }).pipe(Effect.orDie, withPolicy(permission("organization:update"))),
);
