import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { fromGrants } from "../identity/Permission.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { AccessRpcs, CustomRole } from "./AccessRpc.js";

/** The shape better-auth stores in `organizationRole.permission`. */
const StoredGrants = Schema.Record(Schema.String, Schema.Array(Schema.String));

export const ListRoles = AccessRpcs.toLayerHandler("ListRoles", () =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    const rows = yield* sql<{ role: string; permission: string; }>`
      select "role", "permission" from "organizationRole"
      where "organizationId" = ${orgId} order by "role" asc
    `.pipe(Effect.orDie);

    return rows.map((row) =>
      new CustomRole({
        role: row.role,
        // Anything unparseable is reported as an empty role rather than failing
        // the whole listing.
        permissions: Schema.decodeUnknownOption(StoredGrants)(JSON.parse(row.permission)).pipe(
          (option) => option._tag === "Some" ? fromGrants(option.value) : [],
        ),
      })
    );
  }).pipe(withPolicy(permission("ac:read"))));
