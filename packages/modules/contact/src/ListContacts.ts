import { Effect } from "effect";
import { ContactRpcs } from "./ContactRpc.js";
import { ContactStore } from "./ContactStore.js";

export const ListContacts = ContactRpcs.toLayerHandler(
  "ListContacts",
  () => Effect.flatMap(ContactStore, (contacts) => contacts.list),
);
