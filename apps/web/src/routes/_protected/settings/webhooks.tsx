import { sessionAtom } from "@/atom/session-atoms.js";
import { EndpointForm } from "@/components/webhooks/endpoint-form.js";
import { getBilling } from "@/server/reads/billing.js";
import { listDeliveries, listEndpoints } from "@/server/reads/webhook.js";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { billingAtom } from "@vantion/core/atoms/Billing";
import {
  deleteEndpointAtom,
  deliveriesAtom,
  endpointsAtom,
  rotateSecretAtom,
} from "@vantion/core/atoms/Webhook";
import { has } from "@vantion/module-iam/identity/Entitlement";
import type { EndpointId } from "@vantion/module-webhooks/WebhooksRpc";
import { QueryError } from "@vantion/ui/app/query-error";
import { WebhooksPanel } from "@vantion/ui/settings/webhooks-panel";
import { Button } from "@vantion/ui/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@vantion/ui/ui/dialog";
import { Input } from "@vantion/ui/ui/input";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const Webhooks = () => {
  const endpoints = useAtomValue(endpointsAtom);
  const deliveries = useAtomValue(deliveriesAtom);
  const billing = useAtomValue(billingAtom);
  const session = useAtomValue(sessionAtom);
  const rotate = useAtomSet(rotateSecretAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteEndpointAtom, { mode: "promiseExit" });
  const [busy, setBusy] = React.useState(false);
  /** The one moment a secret is on screen. Cleared when the dialog closes. */
  const [secret, setSecret] = React.useState<string | null>(null);

  const onRotate = React.useCallback((id: EndpointId) => {
    setBusy(true);
    void rotate(id).then((exit) => {
      setBusy(false);

      if (!Exit.isSuccess(exit)) return toast.error("That secret could not be rotated");

      /**
       * Rotating takes effect on the **next** delivery, with no overlap — so
       * the toast is not a nicety, it is the only warning a receiver gets that
       * it has to be updated now rather than at leisure.
       */
      setSecret(exit.value.secret);
    });
  }, [rotate]);

  const onRemove = React.useCallback((id: EndpointId) => {
    setBusy(true);
    void remove(id).then((exit) => {
      setBusy(false);
      if (!Exit.isSuccess(exit)) toast.error("That endpoint could not be removed");
    });
  }, [remove]);

  if (AsyncResult.isFailure(endpoints)) {
    return <QueryError result={endpoints} subject="webhooks" />;
  }

  /**
   * All four are hydrated by the loader or by `_protected`, so these are the
   * unreachable arms rather than loading states.
   */
  const rows = AsyncResult.isSuccess(endpoints) ? endpoints.value : [];
  const attempts = AsyncResult.isSuccess(deliveries) ? deliveries.value : [];
  const plan = AsyncResult.isSuccess(billing) ? billing.value.effectivePlan : "free";
  const permissions = AsyncResult.isSuccess(session) ? session.value.permissions : [];

  return (
    <>
      <WebhooksPanel
        endpoints={rows}
        deliveries={attempts}
        entitled={has(plan, "webhooks")}
        canManage={permissions.includes("webhook:manage")}
        busy={busy}
        form={<EndpointForm onCreated={setSecret} />}
        onRotate={onRotate}
        onRemove={onRemove}
      />

      <Dialog open={secret !== null} onOpenChange={(next) => !next && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your signing secret</DialogTitle>
            <DialogDescription>
              This is shown once. Your receiver verifies every delivery with it — the scheme is
              Stripe's, over <code>{"{timestamp}.{body}"}</code>, in the{" "}
              <code>Webhook-Signature</code> header.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input readOnly value={secret ?? ""} className="font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(secret ?? "");
                toast.success("Copied");
              }}
            >
              <Copy className="size-4" aria-hidden />
              Copy
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const Route = createFileRoute("/_protected/settings/webhooks")({
  staticData: { crumb: "Webhooks" },
  /**
   * Three reads for one screen: the endpoints, what was attempted, and the plan
   * — since adding an endpoint is gated on an entitlement and the screen has to
   * say so rather than offer a button that is refused.
   */
  loader: async () => Promise.all([listEndpoints(), listDeliveries(), getBilling()]),
  component: Webhooks,
});
