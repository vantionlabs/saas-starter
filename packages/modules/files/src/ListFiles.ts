import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { FilesRpcs } from "./FilesRpc.js";
import { listFiles } from "./FileStore.js";

export const ListFiles = FilesRpcs.toLayerHandler(
  "ListFiles",
  () => listFiles.pipe(withPolicy(permission("file:read"))),
);
