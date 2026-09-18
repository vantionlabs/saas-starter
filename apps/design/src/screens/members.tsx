import { usePersona } from "@/screens/persona.js";
import { MemberTable } from "@vantion/ui/access/member-table";
import * as React from "react";

export const Members = () => {
  const persona = usePersona();
  const [expanded, setExpanded] = React.useState<string | undefined>(undefined);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Members</h2>
        <p className="text-sm text-muted-foreground">Who can see this organization, and as what</p>
      </div>

      <MemberTable
        members={persona.members}
        expanded={expanded}
        onToggle={(memberId) => setExpanded(expanded === memberId ? undefined : memberId)}
      />
    </section>
  );
};
