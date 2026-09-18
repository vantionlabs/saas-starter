import { CurrentEntitlement, LimitReached } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import { FileId, FilesRpcs, UploadTicket } from "./FilesRpc.js";
import { bytesUsed } from "./FileStore.js";
import { ObjectStore } from "./ObjectStore.js";

/** Long enough for a slow connection to finish, short enough to be worthless later. */
const UPLOAD_WINDOW_SECONDS = 15 * 60;

/**
 * Keys are generated, never accepted.
 *
 * The organization comes first so a bucket policy can be written against the
 * prefix, and the extension is dropped entirely: a caller's filename is display
 * text, and putting it in the key is how somebody ends up with `../../etc` in a
 * path or an executable extension in a public bucket.
 */
const keyFor = (orgId: string, id: string) => `${orgId}/${id}`;

export const RequestUpload = FilesRpcs.toLayerHandler(
  "RequestUpload",
  (payload) =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const store = yield* ObjectStore;
      const { orgId, userId } = yield* CurrentUser;
      const entitlement = yield* CurrentEntitlement;

      const allowed = entitlement.limits.storageMb * 1024 * 1024;

      // Checked before the URL is signed rather than after the bytes arrive: the
      // only moment this application can still say no is before it hands out
      // permission to write.
      if ((yield* bytesUsed) + payload.size > allowed) {
        return yield* new LimitReached({
          limit: "storageMb",
          allowed: entitlement.limits.storageMb,
        });
      }

      const id = FileId.make(randomUUID());
      const key = keyFor(orgId, id);

      const ticket = yield* store.presignUpload(key, {
        contentType: payload.contentType,
        expiresInSeconds: UPLOAD_WINDOW_SECONDS,
      });

      /**
       * The row is written before the bytes exist, and it has to be: the URL
       * names a key, and a key nobody has recorded against a tenant is an object
       * with no owner. It stays `pending` until the upload is confirmed, so an
       * abandoned one leaves a row to collect rather than a file nothing knows
       * about.
       */
      yield* withOrgScope(sql`
      insert into "file"
        ("id", "organizationId", "key", "name", "contentType", "size", "status", "uploadedBy")
      values (${id}, ${orgId}, ${key}, ${payload.name}, ${payload.contentType}, 0, 'pending', ${userId})
    `).pipe(Effect.orDie);

      return new UploadTicket({
        fileId: id,
        url: ticket.url,
        method: "PUT",
        headers: ticket.headers,
      });
    }).pipe(withPolicy(permission("file:create"))),
);
