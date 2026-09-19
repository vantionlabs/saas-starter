import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { filesSerial } from "@vantion/core/atoms/File";

export const listFiles = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(filesSerial, await serverRpc((client) => client("ListFiles", undefined)))
);
