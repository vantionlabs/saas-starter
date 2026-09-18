import { usePersona } from "@/screens/persona.js";
import { ApiKeyTable } from "@vantion/ui/settings/api-key-table";

export const ApiKeys = () => {
  const persona = usePersona();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">API keys</h2>
        <p className="text-sm text-muted-foreground">
          For calling the public API without a browser session.
        </p>
      </div>

      <ApiKeyTable keys={persona.apiKeys} onRevoke={() => {}} />
    </section>
  );
};
