import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect, Option } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { FilesRpcs, UploadIncomplete } from "./FilesRpc.js";
import { findFile, toFile } from "./FileStore.js";
import { ObjectStore } from "./ObjectStore.js";

/**
 * Marks an upload finished, having checked that it is.
 *
 * The client saying "done" is a claim. Asking storage how big the object
 * actually is turns it into a fact, and it is also the only number worth
 * recording: the size in the request was what somebody intended to send.
 */
export const CompleteUpload = FilesRpcs.toLayerHandler(
  "CompleteUpload",
  (payload) =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const store = yield* ObjectStore;
      const { orgId } = yield* CurrentUser;

      const row = yield* findFile(payload.id);

      // A file of another tenant's is not "forbidden", it is not there — telling
      // the two apart out loud would confirm the id exists.
      if (Option.isNone(row)) return yield* new UploadIncomplete();

      const size = yield* store.size(row.value.key);

      if (Option.isNone(size)) return yield* new UploadIncomplete();

      yield* withOrgScope(sql`
      update "file" set "status" = 'ready', "size" = ${size.value}
      where "id" = ${payload.id} and "organizationId" = ${orgId}
    `).pipe(Effect.orDie);

      return toFile({ ...row.value, status: "ready", size: String(size.value) });
    }).pipe(withPolicy(permission("file:create"))),
);
