import { ApiV1 } from "@vantion/domain/api/v1/Api";
import {
  ContactV1,
  Forbidden as ForbiddenBody,
  NotFound,
  TooManyRequests,
  Unauthorized,
} from "@vantion/domain/api/v1/Wire";
import type { Contact } from "@vantion/module-contact/ContactRpc";
import { ContactId } from "@vantion/module-contact/ContactRpc";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { ApiKeyAuth, bearerToken, denialMessage } from "@vantion/module-iam/apikey/ApiKeyAuth";
import { EntitlementResolver } from "@vantion/module-iam/identity/EntitlementResolver";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { rateLimited } from "@vantion/telemetry/Metrics";
import { Effect, Metric } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { RateLimiter } from "effect/unstable/persistence";

/**
 * The v1 handlers.
 *
 * Each one does three things: authenticate the key, call the shared store, and
 * map the domain type onto the frozen wire type. The mapping is the version
 * boundary — rename a domain field and this file stops compiling, which forces a
 * deliberate choice between "map it back" and "this is v2". Returning domain
 * objects directly would make that a silent breaking change.
 */

/** Runs an effect as the key's identity, turning a denial into a 401 body. */
const asKey = <A, E, R>(effect: Effect.Effect<A, E, R | CurrentUser>) =>
  Effect.gen(function*() {
    const auth = yield* ApiKeyAuth;
    const entitlements = yield* EntitlementResolver;
    const request = yield* HttpServerRequest.HttpServerRequest;

    // HTTP is this transport's business, not the service's.
    const identity = yield* bearerToken(request.headers["authorization"]).pipe(
      Effect.flatMap(auth.authenticate),
      Effect.mapError((denied) =>
        new Unauthorized({ error: "unauthorized", message: denialMessage(denied) })
      ),
    );

    /**
     * The public API had no limit at all until this.
     *
     * Keyed on the **organization**, not the key and not the address: a key is
     * a credential and a quota belongs to whoever is paying for it, so issuing
     * a second key should not double what a tenant may do. The allowance is a
     * plan limit, so an upgrade raises it on the next request.
     *
     * Counted in the same store as the auth endpoints — Redis when there is
     * Redis — which is what makes it one limit across every replica rather than
     * one each.
     */
    const limiter = yield* RateLimiter.RateLimiter;
    const entitlement = yield* entitlements.resolve({ organizationId: identity.orgId });

    const allowed = yield* limiter.consume({
      key: `api:v1:${identity.orgId}`,
      limit: entitlement.limits.apiRequestsPerMinute,
      window: "1 minute",
      onExceeded: "fail",
    }).pipe(
      Effect.as(true),
      // A store failure must not take the API down, and an exceeded limit is
      // the caller's problem rather than a defect — the same reading
      // `AuthHttp` takes.
      Effect.catchTag(
        "RateLimiterError",
        (error) => Effect.succeed(error.reason._tag !== "RateLimitExceeded"),
      ),
    );

    if (!allowed) {
      yield* Metric.update(rateLimited, 1);

      /**
       * `Effect.fail`, not `yield*` on the value: these wire errors are
       * `Schema.Class` rather than `Schema.TaggedError`, deliberately — one
       * class per status, so the response code is chosen by matching the
       * declared schema. They are data, not effects.
       */
      return yield* Effect.fail(
        new TooManyRequests({
          error: "too_many_requests",
          message: "This organization has made too many requests. Try again shortly.",
        }),
      );
    }

    return yield* Effect.provideService(effect, CurrentUser, identity);
  });

/** A policy refusal names the permission that was missing. */
const forbidden = (required: string) =>
  new ForbiddenBody({ error: "forbidden", message: `This key's role lacks ${required}.` });

const toContact = (contact: Contact) =>
  new ContactV1({ id: contact.id, email: contact.email, full_name: contact.fullName });

export const ApiV1Live = HttpApiBuilder.group(
  ApiV1,
  "contacts",
  (handlers) =>
    Effect.gen(function*() {
      const contacts = yield* ContactStore;

      return handlers
        .handle("list", () =>
          asKey(contacts.list).pipe(
            Effect.map((rows) => rows.map(toContact)),
            Effect.catchTag("Forbidden", () => Effect.fail(forbidden("contact:read"))),
          ))
        .handle("create", ({ payload }) =>
          asKey(contacts.create({ email: payload.email, fullName: payload.full_name })).pipe(
            Effect.map(toContact),
            Effect.catchTag("Forbidden", () =>
              Effect.fail(forbidden("contact:create"))),
          ))
        .handle("remove", ({ params }) =>
          asKey(contacts.remove(ContactId.make(params.contactId))).pipe(
            // A delete that matched nothing is a 404 rather than a quiet 204:
            // the contract promises the caller can tell those apart.
            Effect.flatMap((removed): Effect.Effect<void, NotFound> =>
              removed ? Effect.void : Effect.fail(
                new NotFound({ error: "not_found", message: "No contact with that id." }),
              )
            ),
            Effect.catchTag("Forbidden", () =>
              Effect.fail(forbidden("contact:delete"))),
          ));
    }),
);
