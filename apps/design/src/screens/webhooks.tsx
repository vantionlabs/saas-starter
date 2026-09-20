import { usePersona } from "@/screens/persona.js";
import { WebhooksPanel } from "@vantion/ui/settings/webhooks-panel";

/**
 * The screen whose interesting states need a **broken** receiver to reach.
 *
 * Nothing configured, one endpoint working, and the crowded case: one switched
 * off after ten consecutive failures beside one limping with three, and a URL
 * long enough to decide whether the column truncates. That last pair is what
 * the screen exists for — "we stopped trying last Tuesday" is the answer to the
 * ticket — and it is the pair nobody would set up by hand to look at.
 *
 * `form` is omitted: registering is effect-form and lives in `apps/web`, so
 * what a designer works on here is the list, the states and the empty case.
 */
export const Webhooks = () => {
  const persona = usePersona();

  return (
    <WebhooksPanel
      endpoints={persona.webhooks}
      deliveries={persona.deliveries}
      entitled
      canManage
      busy={false}
      onRotate={() => {}}
      onRemove={() => {}}
    />
  );
};
