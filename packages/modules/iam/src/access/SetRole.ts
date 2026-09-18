import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import { CurrentUser } from "../identity/Identity.js";
import { toGrants } from "../identity/Permission.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs } from "./AccessRpc.js";

export const SetRole = AccessRpcs.toLayerHandler(
  "SetRole",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;
    const stored = JSON.stringify(toGrants(payload.role.permissions));

    yield* sql.withTransaction(
      Effect.gen(function*() {
        yield* sql`delete from "organizationRole"
                   where "organizationId" = ${orgId} and "role" = ${payload.role.role}`;
        yield* sql`insert into "organizationRole"
                     ("id", "organizationId", "role", "permission", "createdAt")
                   values (${randomUUID()}, ${orgId}, ${payload.role.role}, ${stored}, now())`;
      }),
    ).pipe(Effect.orDie, withPolicy(permission("ac:create")));
  }),
);
