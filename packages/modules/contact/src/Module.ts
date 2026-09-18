import { Layer } from "effect";
import { ContactRpcLive } from "./ContactRpcLive.js";
import { ContactStore } from "./ContactStore.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * `ContactStore` is provideMerged rather than provided: the public API at
 * `/api/v1` runs its handlers over the same store, so it has to be visible
 * outside this module as well as wired into the handlers inside it. One store,
 * two transports, never a handler written twice.
 */
export const ContactModule = ContactRpcLive.pipe(Layer.provideMerge(ContactStore.layer));
