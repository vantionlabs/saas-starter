import { usePersona } from "@/screens/persona.js";
import { ContactForm } from "@vantion/ui/contact/contact-form";
import { ContactTable } from "@vantion/ui/contact/contact-table";

export const Contacts = () => {
  const persona = usePersona();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">People this organization can reach out to</p>
      </div>

      {/* The handlers do nothing. Nothing here writes anywhere. */}
      <ContactForm pending={false} onCreate={() => {}} />
      <ContactTable contacts={persona.contacts} onDelete={() => {}} />
    </section>
  );
};
