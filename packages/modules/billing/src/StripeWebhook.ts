import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { StripeClient } from "./StripeClient.js";
import { apply } from "./Webhook.js";

/**
 * Stripe's webhook endpoint.
 *
 * The body is read as raw text, because the signature covers the bytes Stripe
 * sent and any parse-then-restringify changes them. That is also why this is a
 * route of its own rather than something behind a JSON body parser.
 *
 * It answers 200 to everything it understood, including duplicates and events it
 * chose not to apply. A non-2xx tells Stripe to retry, and retrying an event
 * that was correctly ignored just brings it back forever.
 */
export const StripeWebhook = HttpRouter.add(
  "POST",
  "/api/stripe/webhook",
  Effect.fnUntraced(function*(request: HttpServerRequest.HttpServerRequest) {
    const stripe = yield* StripeClient;
    const signature = request.headers["stripe-signature"];

    if (signature === undefined) {
      return HttpServerResponse.text("missing signature", { status: 400 });
    }

    const body = yield* HttpServerRequest.toWeb(request).pipe(
      Effect.flatMap((web) => Effect.promise(() => web.text())),
    );

    const event = yield* stripe.event({ body, signature }).pipe(
      // A forged webhook should learn nothing from the answer, and a real one
      // that failed verification is a configuration problem visible in Stripe's
      // own dashboard — so it is logged here and acknowledged there.
      Effect.catchTag("WebhookRejected", (rejected) =>
        Effect.as(
          Effect.logWarning(`stripe webhook rejected: ${rejected.reason}`),
          Option.none(),
        )),
    );

    if (Option.isNone(event)) return HttpServerResponse.text("ok");

    const outcome = yield* apply(event.value);

    return HttpServerResponse.text(outcome);
  }),
);
