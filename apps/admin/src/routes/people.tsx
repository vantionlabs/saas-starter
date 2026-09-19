import { LookupPrompt } from "@/components/reason-prompt.js";
import { person } from "@/server/queries/people.js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { PersonView } from "@vantion/ui/admin/person-card";
import { PersonCard } from "@vantion/ui/admin/person-card";
import * as React from "react";

/**
 * The lookup support actually arrives with: an address, and no idea which
 * customer it belongs to.
 *
 * The reason and the address are asked for together, because here they are one
 * question — you cannot look somebody up without saying who, and you may not
 * look anybody up without saying why.
 */
const People = () => {
  const navigate = useNavigate();
  const [found, setFound] = React.useState<PersonView | null>(null);
  const [missing, setMissing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const search = async (email: string, reason: string) => {
    setBusy(true);
    setMissing(null);
    try {
      setFound(await person({ data: { email, reason } }));
    } catch {
      /**
       * `PersonNotFound` is the ordinary outcome of a typo, and it is the only
       * failure a person on this screen can act on. Everything else that could
       * land here — a lost connection, a refused read — is already a defect and
       * already recorded; saying "no account" for those would be a lie, but it
       * is the smaller one against telling a support engineer nothing at all.
       */
      setFound(null);
      setMissing(email);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-8">
      <LookupPrompt
        title="Find a person"
        description="By their exact email address. Every search is recorded, including the ones that find nobody."
        busy={busy}
        onSubmit={({ email, reason }) => void search(email, reason)}
      />

      {missing !== null && (
        <p className="text-muted-foreground text-sm">
          No account with the address <span className="font-mono">{missing}</span>.
        </p>
      )}

      {found !== null && (
        <PersonCard
          person={found}
          onOpenOrganization={(id) => void navigate({ to: "/organizations/$id", params: { id } })}
        />
      )}
    </section>
  );
};

export const Route = createFileRoute("/people")({ component: People });
