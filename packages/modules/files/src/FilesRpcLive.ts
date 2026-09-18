import { Layer } from "effect";
import { CompleteUpload } from "./CompleteUpload.js";
import { DeleteFile } from "./DeleteFile.js";
import { GetDownloadUrl } from "./GetDownloadUrl.js";
import { ListFiles } from "./ListFiles.js";
import { RequestUpload } from "./RequestUpload.js";

/** The files group: a merge of its handlers, and nothing else. */
export const FilesRpcLive = Layer.mergeAll(
  ListFiles,
  RequestUpload,
  CompleteUpload,
  GetDownloadUrl,
  DeleteFile,
);
