import { usePersona } from "@/screens/persona.js";
import { PersonCard } from "@vantion/ui/admin/person-card";

/**
 * The staff lookup, on the same canvas as everything else.
 *
 * Its states are the ones that decide the layout: an account belonging to
 * nothing, an ordinary customer, and the consultant in four organizations whose
 * name and address are both long enough to break a card.
 */
export const AdminPerson = () => {
  const persona = usePersona();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Find a person</h2>
        <p className="text-sm text-muted-foreground">
          One account, and the tenants it belongs to
        </p>
      </div>

      <PersonCard person={persona.person} onOpenOrganization={() => {}} />
    </section>
  );
};
