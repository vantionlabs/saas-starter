import { usePersona } from "@/screens/persona.js";
import { BillingPanel } from "@vantion/ui/settings/billing-panel";
import { UsagePanel } from "@vantion/ui/settings/usage-panel";

/**
 * Billing is the screen a designer can least easily reach in the real product —
 * seeing a lapsed subscription there means having one — so the personas carry
 * the states instead: nothing bought, paying, and a card that has failed.
 */
export const Billing = () => {
  const persona = usePersona();

  return (
    <div className="flex flex-col gap-10">
      <BillingPanel
        state={persona.billing}
        canManage
        onCheckout={() => {}}
        onPortal={() => {}}
      />
      <UsagePanel rows={persona.usage} />
    </div>
  );
};
