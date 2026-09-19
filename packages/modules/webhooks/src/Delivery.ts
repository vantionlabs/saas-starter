import { withWorkerScope } from "@vantion/database/OrgScope";
import { webhookDeliveries } from "@vantion/telemetry/Metrics";
import { Effect, Metric, Result, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import type { Endpoint } from "./Endpoints.js";
import { activeFor, recordOutcome } from "./Endpoints.js";
import type { Envelope } from "./Event.js";
import { ID_HEADER, sign, SIGNATURE_HEADER } from "./Signature.js";

/**
 * The failures a caller can act on: the receiver was unreachable, or it answered
 * with something other than a 2xx. Both mean try again later, which is the
 * queue's business rather than ours.
 */
export class DeliveryFailed extends Schema.TaggedError<DeliveryFailed>()("DeliveryFailed", {
  reason: Schema.Literals(["Unreachable", "Rejected"]),
  status: Schema.NullOr(Schema.Number),
}) {}

/** How long a receiver has to answer before the attempt is abandoned. */
const TIMEOUT = "10 seconds";

const post = Effect.fnUntraced(function*(endpoint: Endpoint, envelope: Envelope) {
  const client = yield* HttpClient.HttpClient;
  const body = JSON.stringify(envelope);

  const request = HttpClientRequest.bodyText(
    HttpClientRequest.post(endpoint.url, {
      headers: {
        [SIGNATURE_HEADER]: sign({ secret: endpoint.secret, body }),
        [ID_HEADER]: envelope.id,
      },
    }),
    body,
    "application/json",
  );

  const response = yield* client.execute(request).pipe(
    Effect.timeoutOrElse({
      duration: TIMEOUT,
      orElse: () => new DeliveryFailed({ reason: "Unreachable", status: null }),
    }),
    Effect.catchTag(
      "HttpClientError",
      () => new DeliveryFailed({ reason: "Unreachable", status: null }),
    ),
  );

  if (response.status < 200 || response.status >= 300) {
    return yield* new DeliveryFailed({ reason: "Rejected", status: response.status });
  }

  return response.status;
});

/**
 * Delivers one event to every active endpoint of its organization.
 *
 * Each endpoint is attempted independently: one receiver being down is not a
 * reason to skip the others, and failing the whole job would retry the ones that
 * already succeeded. The row in `webhookDelivery` is what makes the retry safe —
 * it is keyed on (event, endpoint), so a second attempt updates rather than
 * duplicates, which is what lets the relay be at-least-once without the customer
 * seeing it twice.
 */
export const deliver = Effect.fnUntraced(function*(options: {
  readonly organizationId: string;
  readonly envelope: Envelope;
}) {
  const sql = yield* SqlClient.SqlClient;
  const endpoints = yield* activeFor(options.organizationId);

  let delivered = 0;

  for (const endpoint of endpoints) {
    // `result` rather than letting it fail: one receiver being down is not a
    // reason to skip the others, and failing the job would retry the ones that
    // already succeeded.
    const outcome = yield* Effect.result(post(endpoint, options.envelope));
    const ok = Result.isSuccess(outcome);

    yield* withWorkerScope(sql`
      insert into "webhookDelivery"
        ("id", "organizationId", "endpointId", "eventId", "kind", "status", "attempts",
         "responseStatus", "lastError")
      values (
        ${randomUUID()}, ${options.organizationId}, ${endpoint.id}, ${options.envelope.id},
        ${options.envelope.type}, ${ok ? "delivered" : "failed"}, 1,
        ${Result.isSuccess(outcome) ? outcome.success : outcome.failure.status},
        ${Result.isSuccess(outcome) ? null : outcome.failure.reason}
      )
      on conflict ("eventId", "endpointId") do update set
        "status" = excluded."status",
        "attempts" = "webhookDelivery"."attempts" + 1,
        "responseStatus" = excluded."responseStatus",
        "lastError" = excluded."lastError",
        "at" = now()
    `).pipe(Effect.orDie);

    yield* recordOutcome({ endpointId: endpoint.id, delivered: ok });

    /**
     * One counter with an outcome attribute rather than two counters, so "what
     * share of deliveries failed" is a query rather than arithmetic between
     * series.
     */
    yield* Metric.update(
      Metric.withAttributes(webhookDeliveries, { outcome: ok ? "delivered" : "failed" }),
      1,
    );

    if (ok) delivered += 1;
  }

  return { attempted: endpoints.length, delivered };
});
