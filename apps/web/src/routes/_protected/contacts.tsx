import { hydrated } from "@/server/hydration.js";
import { listContacts } from "@/server/reads.js";
import { HydrationBoundary, useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { contactsAtom, createContactAtom, deleteContactAtom } from "@vantion/core/atoms/Contact";
import { QueryError } from "@vantion/ui/app/query-error";
import { ContactForm } from "@vantion/ui/contact/contact-form";
import { ContactTable } from "@vantion/ui/contact/contact-table";
import { AsyncResult } from "effect/unstable/reactivity";

const Contacts = () => {
  const contacts = useAtomValue(contactsAtom);
  const create = useAtomSet(createContactAtom);
  const creating = useAtomValue(createContactAtom);
  const remove = useAtomSet(deleteContactAtom);

  if (AsyncResult.isFailure(contacts)) {
    return <QueryError result={contacts} subject="contacts" />;
  }

  /**
   * No `isInitial` branch, because the hydrated value is there before this
   * renders. `[]` is the unreachable arm rather than a loading state — and if
   * it ever is reached, an empty table with its own empty state is a better
   * thing to show than a spinner for data that already arrived.
   */
  const rows = AsyncResult.isSuccess(contacts) ? contacts.value : [];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">People this organization can reach out to</p>
      </div>

      <ContactForm pending={creating.waiting} onCreate={create} />

      <ContactTable contacts={rows} onDelete={remove} />
    </section>
  );
};

/**
 * The boundary goes around the screen rather than at the root.
 *
 * What is hydrated is this route's data, so it belongs to this route: a root
 * boundary would need every page's state whether or not it was rendered, and a
 * navigation would have nothing to apply.
 */
const ContactsRoute = () => (
  <HydrationBoundary state={hydrated(Route.useLoaderData())}>
    <Contacts />
  </HydrationBoundary>
);

export const Route = createFileRoute("/_protected/contacts")({
  staticData: { crumb: "Contacts" },
  /**
   * Rendered on the server. `_protected` has resolved the session already, so
   * the forwarded cookie belongs to a caller who is signed in.
   */
  loader: () => listContacts(),
  component: ContactsRoute,
});
