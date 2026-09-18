import { AppRpc } from "@/atom/app-rpc.js";
import { Keys } from "@/atom/reactivity-keys.js";
import type { FileId } from "@vantion/module-files/FilesRpc";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

export const filesAtom = Atom.withReactivity([Keys.organization, Keys.files])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListFiles", undefined);
    }),
  ),
);

/**
 * The upload, all three steps of it.
 *
 * One atom rather than three, because the middle step is a `fetch` straight at
 * storage and the two RPCs on either side are meaningless alone: a ticket
 * nobody used leaves a pending row, and completing an upload that never
 * happened is refused. Keeping them together is what makes the failure of any
 * one of them a single failed upload.
 */
export const uploadFileAtom = AppRpc.runtime.fn<File>()(
  (file) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      const ticket = yield* client("RequestUpload", {
        name: file.name,
        contentType: file.type === "" ? "application/octet-stream" : file.type,
        size: file.size,
      });

      yield* Effect.tryPromise({
        try: () =>
          fetch(ticket.url, {
            method: ticket.method,
            headers: ticket.headers,
            body: file,
          }),
        // Storage refusing is not our error channel's business beyond "it did
        // not work": the ticket was valid, the bytes did not land.
        catch: () => new Error("upload failed"),
      }).pipe(Effect.orDie);

      return yield* client("CompleteUpload", { id: ticket.fileId });
    }),
  { reactivityKeys: [Keys.files] },
);

export const downloadUrlAtom = AppRpc.runtime.fn<FileId>()(
  (id) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("GetDownloadUrl", { id });
    }),
);

export const deleteFileAtom = AppRpc.runtime.fn<FileId>()(
  (id) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("DeleteFile", { id });
    }),
  { reactivityKeys: [Keys.files] },
);
