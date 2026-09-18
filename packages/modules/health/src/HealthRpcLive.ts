import { Layer } from "effect";
import { Check } from "./Check.js";
import { Ping } from "./Ping.js";
import { Watch } from "./Watch.js";

/** Handlers for the health group. */
export const HealthRpcLive = Layer.mergeAll(Ping, Check, Watch);
