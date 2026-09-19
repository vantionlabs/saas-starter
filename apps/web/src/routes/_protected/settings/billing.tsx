import { sessionAtom } from "@/atom/session-atoms.js";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { billingAtom, billingPortalAtom, checkoutAtom } from "@vantion/core/BillingAtoms";
import type { PaidPlan } from "@vantion/module-billing/BillingRpc";
import { QueryError } from "@vantion/ui/app/query-error";
import { BillingPanel } from "@vantion/ui/settings/billing-panel";
import { Skeleton } from "@vantion/ui/ui/skeleton";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";
import { toast } from "sonner";

/**
 * Where Stripe sends the browser back to. `done` does not mean the plan has
 * changed: the subscription is written by the webhook, which usually lands
 * seconds later, so the message says what is actually known.
 */
const outcomeOf = (search: Record<string, unknown>) =>
  search["checkout"] === "done" || search["checkout"] === "cancelled"
    ? search["checkout"]
    : undefined;

const Billing = () => {
  const billing = useAtomValue(billingAtom);
  const refresh = useAtomRefresh(billingAtom);
  const session = useAtomValue(sessionAtom);
  const checkout = useAtomSet(checkoutAtom, { mode: "promiseExit" });
  const portal = useAtomSet(billingPortalAtom, { mode: "promiseExit" });
  const [leaving, setLeaving] = React.useState(false);

  const { checkout: outcome } = Route.useSearch();
  const navigate = Route.useNavigate();

  React.useEffect(() => {
    if (outcome === undefined) return;

    if (outcome === "done") {
      toast.success("Payment received. The plan updates once Stripe confirms it.");
      refresh();
    } else {
      toast("Checkout cancelled. Nothing was charged.");
    }

    // Clear it, so a reload does not announce the same thing again.
    void navigate({ search: { checkout: undefined }, replace: true });
  }, [outcome, refresh, navigate]);

  /** Both buttons end on Stripe's own page, so the browser leaves this one. */
  const leave = React.useCallback(
    async (exit: Promise<Exit.Exit<{ readonly url: string; }, unknown>>) => {
      setLeaving(true);
      const result = await exit;

      if (!Exit.isSuccess(result)) {
        setLeaving(false);
        toast.error("Billing is unavailable right now. Nothing was charged.");
        return;
      }

      window.location.href = result.value.url;
    },
    [],
  );

  if (AsyncResult.isFailure(billing)) {
    return <QueryError result={billing} subject="billing" />;
  }

  if (!AsyncResult.isSuccess(billing) || !AsyncResult.isSuccess(session)) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <BillingPanel
      state={billing.value}
      canManage={session.value.permissions.includes("billing:manage")}
      busy={leaving}
      onCheckout={(plan: PaidPlan) => void leave(checkout(plan))}
      onPortal={() => void leave(portal())}
    />
  );
};

export const Route = createFileRoute("/_protected/settings/billing")({
  staticData: { crumb: "Billing" },
  validateSearch: (search: Record<string, unknown>) => ({ checkout: outcomeOf(search) }),
  component: Billing,
});
