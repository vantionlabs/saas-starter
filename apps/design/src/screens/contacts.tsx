import { usePersona } from "@/screens/persona.js";
import { ContactTable } from "@vantion/ui/contact/contact-table";
import { Button } from "@vantion/ui/ui/button";
import { Input } from "@vantion/ui/ui/input";
import { Label } from "@vantion/ui/ui/label";

export const Contacts = () => {
  const persona = usePersona();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">People this organization can reach out to</p>
      </div>

      {
        /*
        Plain inputs rather than the real form, the same way `sign-in` does it:
        `apps/web` builds this with effect-form, and validation, dirty tracking
        and submit state are the part of a form that has nothing to do with how
        it looks.
      */
      }
      <div className="border-border flex flex-wrap items-end gap-2 rounded-md border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="design-contact-name">Name</Label>
          <Input id="design-contact-name" defaultValue="Ada Lovelace" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="design-contact-email">Email</Label>
          <Input id="design-contact-email" type="email" defaultValue="ada@northwind.test" />
        </div>
        <Button type="button">Add contact</Button>
      </div>

      <ContactTable contacts={persona.contacts} onDelete={() => {}} />
    </section>
  );
};
