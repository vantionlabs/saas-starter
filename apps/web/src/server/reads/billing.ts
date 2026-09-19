import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { billingSerial } from "@vantion/core/atoms/Billing";

export const getBilling = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(billingSerial, await serverRpc((client) => client("GetBilling", undefined)))
);
