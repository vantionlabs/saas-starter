import { sessionAtom } from "@/atom/session-atoms.js";
import { listFiles } from "@/server/reads/file.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import {
  deleteFileAtom,
  downloadUrlAtom,
  filesAtom,
  uploadFileAtom,
} from "@vantion/core/atoms/File";
import type { FileId } from "@vantion/module-files/FilesRpc";
import { MAX_UPLOAD_BYTES } from "@vantion/module-files/FilesRpc";
import { QueryError } from "@vantion/ui/app/query-error";
import { FileTable } from "@vantion/ui/files/file-table";
import { useHydrated } from "@vantion/ui/lib/use-hydrated";
import { Button } from "@vantion/ui/ui/button";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const Files = () => {
  const files = useAtomValue(filesAtom);
  const session = useAtomValue(sessionAtom);
  const upload = useAtomSet(uploadFileAtom, { mode: "promiseExit" });
  const uploading = useAtomValue(uploadFileAtom);
  const download = useAtomSet(downloadUrlAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteFileAtom);
  const input = React.useRef<HTMLInputElement>(null);

  const onPick = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear it immediately, so picking the same file twice in a row still fires.
    event.target.value = "";

    if (file === undefined) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    const result = await upload(file);

    if (Exit.isSuccess(result)) toast.success(`${file.name} uploaded`);
    else toast.error("The upload did not finish. Nothing was saved.");
  }, [upload]);

  const onDownload = React.useCallback(async (id: FileId) => {
    /**
     * The tab is opened *before* the await, and empty.
     *
     * A browser blocks a popup that appears after one, because by then the
     * click is over — which is why the first version of this silently did
     * nothing, and why a browser test was the only thing that could have
     * caught it. `noopener` is not passed because it makes `open` return null
     * by specification; the reference is severed on the next line instead.
     */
    const tab = globalThis.open("", "_blank");

    if (tab !== null) tab.opener = null;

    const result = await download(id);

    if (!Exit.isSuccess(result)) {
      tab?.close();
      toast.error("That file could not be opened.");
      return;
    }

    // A new tab rather than a navigation: the URL is storage's, it expires in
    // minutes, and leaving the application to fetch it would lose the page.
    if (tab === null) globalThis.location.assign(result.value);
    else tab.location.href = result.value;
  }, [download]);

  if (AsyncResult.isFailure(files)) return <QueryError result={files} subject="files" />;

  /** Hydrated before first paint; the empty list is the unreachable arm. */
  const rows = AsyncResult.isSuccess(files) ? files.value : [];
  const permissions = AsyncResult.isSuccess(session) ? session.value.permissions : [];
  const hydrated = useHydrated();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Files</h1>
          <p className="text-muted-foreground text-sm">
            Uploaded straight to storage, and readable only through a link that expires
          </p>
        </div>
        <Button
          /**
           * `!hydrated` because this button's whole job is to run an `onClick`,
           * and the file input below it only uploads when its `onChange` is
           * listened to. Server rendering puts both in the document first, so
           * without this the control looks live and silently does nothing —
           * Forms do not need this — effect-form does not render its fields on
           * the server at all, so there is nothing to type into early. A bare
           * button is the case that does, and this is the signal it gives.
           */
          disabled={!hydrated || uploading.waiting || !permissions.includes("file:create")}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {uploading.waiting ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={input}
          type="file"
          className="hidden"
          aria-label="File to upload"
          onChange={(event) => void onPick(event)}
        />
      </div>

      <FileTable
        files={rows}
        canDelete={permissions.includes("file:delete")}
        onDownload={(id) => void onDownload(id)}
        onDelete={remove}
      />
    </section>
  );
};

export const Route = createFileRoute("/_protected/files")({
  staticData: { crumb: "Files" },
  loader: () => listFiles(),
  component: Files,
});
