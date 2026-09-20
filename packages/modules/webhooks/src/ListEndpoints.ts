import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { listForCaller } from "./Endpoints.js";
import { EndpointId, WebhookEndpoint, WebhooksRpcs } from "./WebhooksRpc.js";

/**
 * Deliberately **not** gated on `feature("webhooks")`.
 *
 * An organization that has downgraded still has its endpoints, and the screen
 * that shows them is where somebody goes to understand why deliveries stopped.
 * Gating the read would answer "why has nothing arrived?" with an empty page.
 * What the plan gates is *registering* one.
 */
export const ListEndpoints = WebhooksRpcs.toLayerHandler(
  "ListEndpoints",
  () =>
    listForCaller().pipe(
      Effect.map((rows) =>
        rows.map((row) =>
          new WebhookEndpoint({
            id: EndpointId.make(row.id),
            url: row.url,
            active: row.active,
            consecutiveFailures: row.consecutiveFailures,
            createdAt: row.createdAt.toISOString(),
          })
        )
      ),
      withPolicy(permission("webhook:read")),
    ),
);
