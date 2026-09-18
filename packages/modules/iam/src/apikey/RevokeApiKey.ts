import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { OrganizationRpcs } from "../organization/OrganizationRpc.js";

export const RevokeApiKey = OrganizationRpcs.toLayerHandler(
  "RevokeApiKey",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;

    yield* withOrgScope(sql`
      delete from "apiKey"
      where "id" = ${payload.id} and "organizationId" = ${identity.orgId}
    `).pipe(Effect.orDie, withPolicy(permission("organization:update")));
  }),
);
