import { Layer } from "effect";
import { GetBilling } from "./GetBilling.js";
import { OpenBillingPortal } from "./OpenBillingPortal.js";
import { StartCheckout } from "./StartCheckout.js";

/** The three procedures a billing screen needs, and nothing else. */
export const BillingRpcLive = Layer.mergeAll(GetBilling, StartCheckout, OpenBillingPortal);
