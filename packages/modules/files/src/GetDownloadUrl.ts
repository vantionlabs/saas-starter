import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect, Option } from "effect";
import { FilesRpcs } from "./FilesRpc.js";
import { findFile } from "./FileStore.js";
import { ObjectStore, StorageUnavailable } from "./ObjectStore.js";

/** Short-lived on purpose: a link that works forever is a file that is public. */
const DOWNLOAD_WINDOW_SECONDS = 5 * 60;

export const GetDownloadUrl = FilesRpcs.toLayerHandler(
  "GetDownloadUrl",
  (payload) =>
    Effect.gen(function*() {
      const store = yield* ObjectStore;
      const row = yield* findFile(payload.id);

      if (Option.isNone(row)) return yield* new StorageUnavailable({ reason: "Rejected" });

      return yield* store.presignDownload(row.value.key, {
        expiresInSeconds: DOWNLOAD_WINDOW_SECONDS,
        contentType: row.value.contentType,
      });
    }).pipe(withPolicy(permission("file:read"))),
);
