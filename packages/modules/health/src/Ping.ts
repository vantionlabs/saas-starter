import { Effect } from "effect";
import { HealthRpcs } from "./HealthRpc.js";

/** Liveness: the process answered, and that is the whole claim. */
export const Ping = HealthRpcs.toLayerHandler("Ping", () => Effect.void);
