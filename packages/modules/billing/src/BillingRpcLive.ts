import { Layer } from "effect";
import { GetBilling } from "./GetBilling.js";
import { OpenBillingPortal } from "./OpenBillingPortal.js";
import { StartCheckout } from "./StartCheckout.js";
import { GetUsage } from "./Usage.js";

/** The procedures a billing screen needs, and nothing else. */
export const BillingRpcLive = Layer.mergeAll(
  GetBilling,
  GetUsage,
  StartCheckout,
  OpenBillingPortal,
);
