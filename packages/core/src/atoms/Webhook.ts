import type { EndpointId } from "@vantion/module-webhooks/WebhooksRpc";
import { WebhookDelivery, WebhookEndpoint } from "@vantion/module-webhooks/WebhooksRpc";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { AppRpc } from "../AppRpc.js";
import { Keys } from "../Keys.js";

/** Rendered on the server; the key and schema are shared with its loader. */
export const endpointsSerial = {
  key: "webhookEndpoints",
  schema: AsyncResult.Schema({ success: Schema.Array(WebhookEndpoint) }),
};

export const endpointsAtom = Atom.withReactivity([Keys.organization, Keys.webhooks])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListEndpoints", undefined);
    }),
  ),
).pipe(Atom.serializable(endpointsSerial));

export const deliveriesSerial = {
  key: "webhookDeliveries",
  schema: AsyncResult.Schema({ success: Schema.Array(WebhookDelivery) }),
};

/**
 * Attempts, read on the same screen as the endpoints and invalidated with them:
 * deleting an endpoint cascades to its deliveries, so a list that survived the
 * delete would show attempts against a row that is gone.
 */
export const deliveriesAtom = Atom.withReactivity([Keys.organization, Keys.webhooks])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListDeliveries", undefined);
    }),
  ),
).pipe(Atom.serializable(deliveriesSerial));

/**
 * All three writes invalidate `webhooks`, and also `billing` — the usage panel
 * counts endpoints against the plan's limit, so adding or removing one changes
 * a number on a different screen. Declared with the write rather than at the
 * call site, as every other write here declares it.
 */
const keys = [Keys.webhooks, Keys.billing];

export const rotateSecretAtom = AppRpc.runtime.fn<EndpointId>()(
  (id) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("RotateSecret", { id });
    }),
  { reactivityKeys: keys },
);

export const deleteEndpointAtom = AppRpc.runtime.fn<EndpointId>()(
  (id) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("DeleteEndpoint", { id });
    }),
  { reactivityKeys: keys },
);
