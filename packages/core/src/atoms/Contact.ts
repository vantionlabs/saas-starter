import type { ContactId } from "@vantion/module-contact/ContactRpc";
import { Contact, Overview } from "@vantion/module-contact/ContactRpc";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { AppRpc } from "../AppRpc.js";
import { Keys } from "../Keys.js";

/**
 * Reads are declared by naming the RPC; writes stay hand-written.
 *
 * `AppRpc.query` builds the atom, so there is no service to yield and no effect
 * to write for a plain fetch. `AppRpc.mutation` exists too, but its reactivity
 * keys are supplied per *call* rather than per definition — which would scatter
 * "what does this invalidate" across every call site and make it something to
 * forget. Keeping writes as `runtime.fn` keeps that answer in one place, next to
 * the write it belongs to.
 */
const reads = [Keys.organization, Keys.contacts];

/**
 * The serialization metadata for a read the server can render, declared beside
 * the atom rather than in the app that renders it.
 *
 * A key and a schema are what `Atom.serializable` needs to put a value into a
 * registry from outside, and the server needs the *same* pair to encode it.
 * Exporting them together is what stops the two halves drifting — a mismatched
 * key silently hydrates nothing, and the page quietly fetches again.
 *
 * `apps/mobile` imports the atom and ignores this, which is the point: the
 * metadata costs a phone nothing and the query stays one definition.
 */
export const contactsSerial = {
  key: "contacts",
  schema: AsyncResult.Schema({ success: Schema.Array(Contact) }),
};

export const contactsAtom = AppRpc.query("ListContacts", undefined, { reactivityKeys: reads })
  .pipe(Atom.serializable(contactsSerial));

export const overviewSerial = {
  key: "overview",
  schema: AsyncResult.Schema({ success: Overview }),
};

export const overviewAtom = AppRpc.query("GetOverview", undefined, { reactivityKeys: reads })
  .pipe(Atom.serializable(overviewSerial));

export const createContactAtom = AppRpc.runtime.fn<
  { readonly email: string; readonly fullName: string; }
>()(
  (input) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("CreateContact", input);
    }),
  { reactivityKeys: [Keys.contacts] },
);

export const deleteContactAtom = AppRpc.runtime.fn<ContactId>()(
  (id) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("DeleteContact", { id });
    }),
  { reactivityKeys: [Keys.contacts] },
);
