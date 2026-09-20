import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { rotate } from "./Endpoints.js";
import { EndpointNotFound, EndpointSecret, WebhooksRpcs } from "./WebhooksRpc.js";

/**
 * A new signing secret, on an endpoint that stays where it is.
 *
 * No `feature("webhooks")`, and the omission is deliberate: an organization
 * that has downgraded must still be able to rotate a secret it believes is
 * leaked. Taking that away would make a lapsed plan a security problem, which
 * is the same reasoning that leaves a `canceled` subscription on the free plan
 * rather than on nothing.
 */
export const RotateSecret = WebhooksRpcs.toLayerHandler(
  "RotateSecret",
  (payload) =>
    rotate(payload.id).pipe(
      Effect.flatMap((secret) =>
        secret === undefined
          ? new EndpointNotFound()
          : Effect.succeed(new EndpointSecret({ id: payload.id, secret }))
      ),
      withPolicy(permission("webhook:manage")),
    ),
);
