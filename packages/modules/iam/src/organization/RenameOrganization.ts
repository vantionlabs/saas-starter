import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { OrganizationRpcs } from "./OrganizationRpc.js";

export const RenameOrganization = OrganizationRpcs.toLayerHandler(
  "RenameOrganization",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;

    yield* sql`update "organization" set "name" = ${payload.name} where "id" = ${identity.orgId}`
      .pipe(Effect.orDie, withPolicy(permission("organization:update")));
  }),
);
