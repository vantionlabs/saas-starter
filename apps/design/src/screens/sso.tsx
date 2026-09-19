import { usePersona } from "@/screens/persona.js";
import { SsoPanel } from "@vantion/ui/settings/sso-panel";

/**
 * The three states a designer cannot otherwise see without owning domains and
 * an identity provider: nothing configured, one live, and one live beside one
 * still waiting on a DNS record — which is the pair the screen has to explain.
 */
export const Sso = () => {
  const persona = usePersona();

  return (
    <SsoPanel
      providers={persona.sso}
      entitled
      canManage
      busy={false}
      onAdd={() => {}}
      onRemove={() => {}}
      onVerify={() => {}}
    />
  );
};
