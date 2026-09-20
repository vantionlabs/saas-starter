import { usePersona } from "@/screens/persona.js";
import { ScimPanel } from "@vantion/ui/settings/scim-panel";

/**
 * Directory sync, in its three states: not on the plan, nothing connected yet,
 * and one live.
 *
 * The middle one is the interesting one to design and the easiest to forget —
 * it is the screen a customer sees for the whole gap between buying the plan
 * and their IT team getting round to it, and it has to say what to do next
 * rather than just that there is nothing here.
 */
export const Scim = () => {
  const persona = usePersona();

  return (
    <ScimPanel
      connections={persona.scimConnections}
      entitled
      canManage
      busy={false}
      baseUrl="https://api.example.com"
      onGenerate={() => {}}
      onRemove={() => {}}
    />
  );
};
