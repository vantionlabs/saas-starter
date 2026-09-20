import { Layer } from "effect";
import { DeleteEndpoint } from "./DeleteEndpoint.js";
import { ListDeliveries } from "./ListDeliveries.js";
import { ListEndpoints } from "./ListEndpoints.js";
import { RegisterEndpoint } from "./RegisterEndpoint.js";
import { RotateSecret } from "./RotateSecret.js";

/** What a webhooks settings screen needs, and nothing else. */
export const WebhooksRpcLive = Layer.mergeAll(
  ListEndpoints,
  ListDeliveries,
  RegisterEndpoint,
  RotateSecret,
  DeleteEndpoint,
);
