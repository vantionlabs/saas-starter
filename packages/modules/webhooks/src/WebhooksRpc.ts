import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { LimitReached } from "@vantion/module-iam/identity/Entitlement";
import { Forbidden } from "@vantion/module-iam/identity/Policy";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import type { UrlRefusal } from "./DeliverableUrl.js";
import { loopbackAllowed, refuseUrl } from "./DeliverableUrl.js";

export const EndpointId = Schema.String.pipe(Schema.brand("EndpointId")).annotate({
  identifier: "EndpointId",
});
export type EndpointId = typeof EndpointId.Type;

/**
 * The field rules, declared once and used by the procedure *and* the form —
 * the same arrangement `ContactFields` has, so the screen refuses exactly what
 * the server refuses and the sentence somebody reads is written where the rule
 * is.
 *
 * The URL check is not politeness. `DeliverableUrl.ts` explains it at length:
 * this is a URL a customer chooses and a server of ours then fetches, so an
 * unchecked one is server-side request forgery with a form in front of it.
 */
const refusals: Record<UrlRefusal, string> = {
  NotAUrl: "That is not a URL.",
  NotHttps: "Use an https:// address — deliveries carry your customers' data.",
  PrivateHost: "That address is on a private network, so nothing could reach it.",
};

export const EndpointFields = {
  url: Schema.String.check(
    Schema.isNonEmpty({ message: "Enter a URL." }),
    Schema.makeFilter((value: string) => {
      const refusal = refuseUrl(value, { allowLoopback: loopbackAllowed() });

      return refusal === undefined ? undefined : refusals[refusal];
    }),
  ),
};

/**
 * An endpoint, as the settings screen shows it — and **without the secret**.
 *
 * That omission is the point. The secret is the credential a receiver verifies
 * with, it is held in clear because signing needs the value rather than a hash
 * of it, and a list that carried it would put every tenant's signing key into
 * the page's dehydrated state on every visit. It is returned exactly twice:
 * when it is created, and when it is rotated.
 */
export class WebhookEndpoint extends Schema.Class<WebhookEndpoint>("WebhookEndpoint")({
  id: EndpointId,
  url: Schema.String,
  /**
   * Switched off after ten consecutive failures. Shown rather than hidden,
   * because "we stopped trying last Tuesday" is the answer to the ticket.
   */
  active: Schema.Boolean,
  consecutiveFailures: Schema.Number,
  createdAt: Schema.String,
}) {}

/** Shown once. Storing it is the receiver's job; we cannot show it again. */
export class EndpointSecret extends Schema.Class<EndpointSecret>("EndpointSecret")({
  id: EndpointId,
  secret: Schema.String,
}) {}

/**
 * One attempt, as the screen shows it.
 *
 * This table has existed since outbound delivery shipped and nothing has ever
 * read it, which is the gap this closes: "did you send it?" is the first
 * question a customer asks, and until now the only way to answer was a SQL
 * prompt.
 */
export class WebhookDelivery extends Schema.Class<WebhookDelivery>("WebhookDelivery")({
  id: Schema.String,
  endpointId: EndpointId,
  /** The outbox row's id — what a receiver deduplicates on, so it is worth showing. */
  eventId: Schema.String,
  kind: Schema.String,
  status: Schema.Literals(["pending", "delivered", "failed"]),
  attempts: Schema.Number,
  responseStatus: Schema.NullOr(Schema.Number),
  lastError: Schema.NullOr(Schema.String),
  at: Schema.String,
}) {}

/** Rotating or deleting something that is not there. */
export class EndpointNotFound extends Schema.TaggedError<EndpointNotFound>()(
  "EndpointNotFound",
  {},
) {}

export const WebhooksRpcs = RpcGroup.make(
  Rpc.make("ListEndpoints", { success: Schema.Array(WebhookEndpoint), error: Forbidden }),
  /**
   * `LimitReached` beside `Forbidden`, because they are different answers:
   * one says this caller may not, the other says this plan does not stretch
   * that far — and only the second comes with a number worth showing.
   */
  Rpc.make("RegisterEndpoint", {
    payload: EndpointFields,
    success: EndpointSecret,
    error: Schema.Union([Forbidden, LimitReached]),
  }),
  /**
   * Rotating replaces the secret and keeps the endpoint, which is the whole
   * reason it is not "delete and re-add": the deliveries already recorded
   * against it are the history somebody is looking at when they decide to
   * rotate, and re-adding would throw them away.
   *
   * There is no overlap window — the next delivery is signed with the new
   * secret. Two live secrets would be the kinder design and a second column;
   * `docs/webhooks.md` says so rather than this pretending to be one.
   */
  Rpc.make("RotateSecret", {
    payload: { id: EndpointId },
    success: EndpointSecret,
    error: Schema.Union([Forbidden, EndpointNotFound]),
  }),
  Rpc.make("DeleteEndpoint", {
    payload: { id: EndpointId },
    success: Schema.Void,
    error: Schema.Union([Forbidden, EndpointNotFound]),
  }),
  /**
   * Recent attempts across every endpoint, newest first. The limit is part of
   * the read rather than a parameter, so a loader and an atom cannot ask for
   * different amounts and hydrate a list the other then replaces.
   */
  Rpc.make("ListDeliveries", {
    success: Schema.Array(WebhookDelivery),
    error: Forbidden,
  }),
).middleware(AuthMiddleware);
