import { Effect } from "effect";
import { ContactRpcs } from "./ContactRpc.js";
import { ContactStore } from "./ContactStore.js";

export const CreateContact = ContactRpcs.toLayerHandler(
  "CreateContact",
  Effect.fnUntraced(function*(payload) {
    const contacts = yield* ContactStore;

    return yield* contacts.create(payload);
  }),
);
