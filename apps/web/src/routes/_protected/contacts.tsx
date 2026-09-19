import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { contactsAtom, createContactAtom, deleteContactAtom } from "@vantion/core/ContactAtoms";
import { QueryError } from "@vantion/ui/app/query-error";
import { ContactForm } from "@vantion/ui/contact/contact-form";
import { ContactTable } from "@vantion/ui/contact/contact-table";
import { AsyncResult } from "effect/unstable/reactivity";

const Contacts = () => {
  const contacts = useAtomValue(contactsAtom);
  const create = useAtomSet(createContactAtom);
  const creating = useAtomValue(createContactAtom);
  const remove = useAtomSet(deleteContactAtom);

  if (AsyncResult.isInitial(contacts)) {
    return <p className="text-sm text-muted-foreground">loading…</p>;
  }

  if (AsyncResult.isFailure(contacts)) {
    return <QueryError result={contacts} subject="contacts" />;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">People this organization can reach out to</p>
      </div>

      <ContactForm
        pending={creating.waiting}
        onCreate={create}
      />

      <ContactTable
        contacts={contacts.value}
        onDelete={remove}
      />
    </section>
  );
};

export const Route = createFileRoute("/_protected/contacts")({
  staticData: { crumb: "Contacts" },
  component: Contacts,
});
