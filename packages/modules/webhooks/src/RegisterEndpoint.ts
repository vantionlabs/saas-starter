import { CurrentEntitlement, LimitReached } from "@vantion/module-iam/identity/Entitlement";
import { all, feature, permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { countForCaller, register } from "./Endpoints.js";
import { EndpointId, EndpointSecret, WebhooksRpcs } from "./WebhooksRpc.js";

/**
 * Adding a place to deliver to, which is the thing this module was missing.
 *
 * Every other half of outbound delivery has existed and been tested since it
 * shipped — the transactional outbox, the signature, the retries, the
 * auto-disable — and none of it was reachable, because nothing called
 * `register`. A pipeline no customer can start is a pipeline that only the
 * tests use.
 *
 * Gated on **both**: `webhook:manage` is whether this person may, and
 * `feature("webhooks")` is whether this organization's plan includes them at
 * all. `Policy.all` composes the two into one question, resolved once.
 */
const create = Effect.fnUntraced(function*(payload: { readonly url: string; }) {
  const entitlement = yield* CurrentEntitlement;
  const allowed = entitlement.limits.webhookEndpoints;

  /**
   * Counted before the secret is generated, for the reason `CreateApiKey`
   * gives: the last moment to refuse is before a credential exists. A plan
   * that promises five endpoints and takes a sixth makes the usage screen a
   * lie rather than a reason to upgrade.
   */
  if ((yield* countForCaller()) >= allowed) {
    return yield* new LimitReached({ limit: "webhookEndpoints", allowed });
  }

  const created = yield* register(payload.url);

  return new EndpointSecret({ id: EndpointId.make(created.id), secret: created.secret });
});

/**
 * The policy wraps the whole handler rather than the insert, so who you are is
 * settled before anything about the plan is. The other way round, somebody with
 * no right to add an endpoint would be told how many the organization has left.
 */
export const RegisterEndpoint = WebhooksRpcs.toLayerHandler(
  "RegisterEndpoint",
  (payload) =>
    create(payload).pipe(withPolicy(all(permission("webhook:manage"), feature("webhooks")))),
);
