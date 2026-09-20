import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { deliveriesSerial, endpointsSerial } from "@vantion/core/atoms/Webhook";

export const listEndpoints = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(endpointsSerial, await serverRpc((client) => client("ListEndpoints", undefined)))
);

/**
 * A second read for the same screen. The attempts are what answer the question
 * somebody actually arrives with, so they come down with the document rather
 * than after it — the endpoints alone would render a page that says everything
 * is configured and nothing about whether it works.
 */
export const listDeliveries = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(deliveriesSerial, await serverRpc((client) => client("ListDeliveries", undefined)))
);
