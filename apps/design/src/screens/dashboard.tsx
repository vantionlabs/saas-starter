import { usePersona } from "@/screens/persona.js";
import { StatCard } from "@vantion/ui/dashboard/stat-card";

export const Dashboard = () => {
  const persona = usePersona();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your organization at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contacts" value={persona.contacts.length} />
        <StatCard label="Members" value={persona.members.length} />
        <StatCard label="Custom roles" value={persona.roles.length} />
      </div>
    </section>
  );
};
