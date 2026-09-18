import { Effect } from "effect";
import { ContactRpcs } from "./ContactRpc.js";
import { ContactStore } from "./ContactStore.js";

export const DeleteContact = ContactRpcs.toLayerHandler(
  "DeleteContact",
  Effect.fnUntraced(function*(payload) {
    const contacts = yield* ContactStore;

    // The flag is for the public API's 404; this transport promises Void.
    yield* contacts.remove(payload.id).pipe(Effect.asVoid);
  }),
);
