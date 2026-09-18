import { usePersona } from "@/screens/persona.js";
import { BillingPanel } from "@vantion/ui/settings/billing-panel";

/**
 * Billing is the screen a designer can least easily reach in the real product —
 * seeing a lapsed subscription there means having one — so the personas carry
 * the states instead: nothing bought, paying, and a card that has failed.
 */
export const Billing = () => {
  const persona = usePersona();

  return (
    <BillingPanel
      state={persona.billing}
      canManage
      onCheckout={() => {}}
      onPortal={() => {}}
    />
  );
};
