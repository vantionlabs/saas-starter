import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { contactsSerial, overviewSerial } from "@vantion/core/atoms/Contact";

export const listContacts = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(contactsSerial, await serverRpc((client) => client("ListContacts", undefined)))
);

export const getOverview = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(overviewSerial, await serverRpc((client) => client("GetOverview", undefined)))
);
