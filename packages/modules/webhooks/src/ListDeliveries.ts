import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { recentForCaller } from "./DeliveryLog.js";
import { EndpointId, WebhookDelivery, WebhooksRpcs } from "./WebhooksRpc.js";

export const ListDeliveries = WebhooksRpcs.toLayerHandler(
  "ListDeliveries",
  () =>
    recentForCaller().pipe(
      Effect.map((rows) =>
        rows.map((row) =>
          new WebhookDelivery({
            id: row.id,
            endpointId: EndpointId.make(row.endpointId),
            eventId: row.eventId,
            kind: row.kind,
            status: row.status,
            attempts: row.attempts,
            responseStatus: row.responseStatus,
            lastError: row.lastError,
            at: row.at.toISOString(),
          })
        )
      ),
      withPolicy(permission("webhook:read")),
    ),
);
