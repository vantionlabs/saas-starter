import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { LimitReached } from "@vantion/module-iam/identity/Entitlement";
import { Forbidden } from "@vantion/module-iam/identity/Policy";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { StorageUnavailable } from "./FilesErrors.js";

export const FileId = Schema.String.pipe(Schema.brand("FileId")).annotate({
  identifier: "FileId",
});
export type FileId = typeof FileId.Type;

/** The largest single object this application will sign for. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class StoredFile extends Schema.Class<StoredFile>("StoredFile")({
  id: FileId,
  name: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
  /** `pending` until the bytes are confirmed to be there. */
  status: Schema.Literals(["pending", "ready"]),
  createdAt: Schema.String,
}) {}

/** Where to send the bytes, and the row they will belong to. */
export class UploadTicket extends Schema.Class<UploadTicket>("UploadTicket")({
  fileId: FileId,
  url: Schema.String,
  method: Schema.Literals(["PUT"]),
  headers: Schema.Record(Schema.String, Schema.String),
}) {}

/** The upload never arrived, so there is nothing to mark ready. */
export class UploadIncomplete extends Schema.TaggedError<UploadIncomplete>()(
  "UploadIncomplete",
  {},
) {}

export const FilesRpcs = RpcGroup.make(
  Rpc.make("ListFiles", { success: Schema.Array(StoredFile), error: Forbidden }),
  /**
   * Step one of two, and the reason uploading is not a single call: the bytes
   * go straight to storage, so what an application hands out is permission to
   * write one object, not a place to post a form to.
   *
   * The key is generated here and never accepted from the caller. It carries
   * the organization as a prefix, so a bucket policy can be written against it
   * and a mistake is caught by storage as well as by row-level security.
   */
  Rpc.make("RequestUpload", {
    payload: {
      name: Schema.String.check(Schema.isNonEmpty()),
      contentType: Schema.String.check(Schema.isNonEmpty()),
      size: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_UPLOAD_BYTES })),
    },
    success: UploadTicket,
    error: Schema.Union([Forbidden, LimitReached, StorageUnavailable]),
  }),
  /**
   * Step two. The client says it is done and the server checks, because a
   * client saying so is a claim rather than a fact — and the size recorded is
   * storage's, not the one the client asked for.
   */
  Rpc.make("CompleteUpload", {
    payload: { id: FileId },
    success: StoredFile,
    error: Schema.Union([Forbidden, UploadIncomplete, StorageUnavailable]),
  }),
  Rpc.make("GetDownloadUrl", {
    payload: { id: FileId },
    success: Schema.String,
    error: Schema.Union([Forbidden, StorageUnavailable]),
  }),
  Rpc.make("DeleteFile", {
    payload: { id: FileId },
    success: Schema.Void,
    error: Schema.Union([Forbidden, StorageUnavailable]),
  }),
).middleware(AuthMiddleware);
