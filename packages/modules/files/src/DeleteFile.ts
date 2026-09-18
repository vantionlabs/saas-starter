import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect, Option } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { FilesRpcs } from "./FilesRpc.js";
import { findFile } from "./FileStore.js";
import { ObjectStore } from "./ObjectStore.js";

/**
 * The row goes first, the object second.
 *
 * That order is deliberate. If the delete of the bytes fails, what is left is
 * an object nothing points at — waste, collectable later. The other order
 * leaves a row pointing at bytes that are gone, which is a download that breaks
 * for a customer rather than a cost for us.
 */
export const DeleteFile = FilesRpcs.toLayerHandler(
  "DeleteFile",
  (payload) =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const store = yield* ObjectStore;
      const { orgId } = yield* CurrentUser;

      const row = yield* findFile(payload.id);

      // Deleting something that is not there is a success: the caller wanted it
      // gone, and it is gone.
      if (Option.isNone(row)) return;

      yield* withOrgScope(sql`
      delete from "file" where "id" = ${payload.id} and "organizationId" = ${orgId}
    `).pipe(Effect.orDie);

      yield* store.remove(row.value.key);
    }).pipe(withPolicy(permission("file:delete"))),
);
