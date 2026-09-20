import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { remove } from "./Endpoints.js";
import { EndpointNotFound, WebhooksRpcs } from "./WebhooksRpc.js";

/**
 * Removing an endpoint, and its delivery history with it — the foreign key
 * cascades, which is why rotating exists as a separate act rather than being
 * "delete and add again".
 *
 * No plan gate, for the reason `RotateSecret` gives: stopping deliveries must
 * never be the thing a downgrade takes away.
 */
export const DeleteEndpoint = WebhooksRpcs.toLayerHandler(
  "DeleteEndpoint",
  (payload) =>
    remove(payload.id).pipe(
      Effect.flatMap((deleted) => deleted ? Effect.void : new EndpointNotFound()),
      withPolicy(permission("webhook:manage")),
    ),
);
