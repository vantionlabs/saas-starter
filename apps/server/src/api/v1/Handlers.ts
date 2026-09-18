import { ApiV1 } from "@vantion/domain/api/v1/Api";
import {
  ContactV1,
  Forbidden as ForbiddenBody,
  NotFound,
  Unauthorized,
} from "@vantion/domain/api/v1/Wire";
import type { Contact } from "@vantion/module-contact/ContactRpc";
import { ContactId } from "@vantion/module-contact/ContactRpc";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { ApiKeyAuth, bearerToken, denialMessage } from "@vantion/module-iam/apikey/ApiKeyAuth";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

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
    const request = yield* HttpServerRequest.HttpServerRequest;

    // HTTP is this transport's business, not the service's.
    const identity = yield* bearerToken(request.headers["authorization"]).pipe(
      Effect.flatMap(auth.authenticate),
      Effect.mapError((denied) =>
        new Unauthorized({ error: "unauthorized", message: denialMessage(denied) })
      ),
    );

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
