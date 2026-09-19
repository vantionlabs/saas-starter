import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { billingSerial, usageSerial } from "@vantion/core/atoms/Billing";

export const getBilling = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(billingSerial, await serverRpc((client) => client("GetBilling", undefined)))
);

/**
 * A second read for the same screen, so the two arrive together and neither
 * waits for the other. It is separate from `getBilling` on the server for the
 * reason the procedures are separate: this one counts rows in three tables, and
 * every other settings page would have paid for it.
 */
export const getUsage = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(usageSerial, await serverRpc((client) => client("GetUsage", undefined)))
);
