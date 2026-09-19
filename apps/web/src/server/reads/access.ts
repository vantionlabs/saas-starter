import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { membersSerial, rolesSerial } from "@vantion/core/atoms/Access";

export const listMembers = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(membersSerial, await serverRpc((client) => client("ListMembers", undefined)))
);

export const listRoles = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(rolesSerial, await serverRpc((client) => client("ListRoles", undefined)))
);
