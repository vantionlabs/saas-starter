import type { BillingState, PaidPlan } from "@vantion/module-billing/BillingRpc";
import type { Feature, Plan } from "@vantion/module-iam/identity/Entitlement";
import { features, limits } from "@vantion/module-iam/identity/Entitlement";
import { Check, ExternalLink } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Separator } from "../ui/separator.js";

const order: ReadonlyArray<Plan> = ["free", "pro", "scale"];

const featureLabels: Record<Feature, string> = {
  api_keys: "API keys",
  custom_roles: "Custom roles",
  webhooks: "Outbound webhooks",
  sso: "Single sign-on",
};

const planLabels: Record<Plan, string> = { free: "Free", pro: "Pro", scale: "Scale" };

/**
 * Status is shown as the customer's own words for it, not ours.
 *
 * `past_due` is the one that matters: the plan is still switched on, and saying
 * so beside the warning is what stops a failed card reading as a suspension.
 */
const statusNote: Record<BillingState["status"], string | null> = {
  active: null,
  trialing: "Trial",
  past_due: "Payment failed — the plan stays on while it is retried",
  canceled: "Cancelled — the organization is on the free plan",
  incomplete: "Checkout was never finished, so nothing is switched on yet",
};

const renewal = (state: BillingState) => {
  if (state.currentPeriodEnd === null) return null;

  const date = state.currentPeriodEnd.slice(0, 10);

  return state.cancelAtPeriodEnd ? `Access ends ${date}` : `Renews ${date}`;
};

/**
 * The billing screen, entirely prop-driven so `apps/design` renders every state
 * of it — including the ones that need a Stripe account to reach.
 */
export const BillingPanel = (props: {
  readonly state: BillingState;
  /** Whether the caller holds `billing:manage`. Read-only is the member's view. */
  readonly canManage: boolean;
  readonly busy?: boolean;
  readonly onCheckout: (plan: PaidPlan) => void;
  readonly onPortal: () => void;
}) => {
  const { state } = props;
  const note = statusNote[state.status];
  const renews = renewal(state);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Billing</h2>
          <p className="text-muted-foreground text-sm">
            What this organization is on, and what each plan carries.
          </p>
        </div>
        {props.canManage && state.manageable && (
          <Button variant="outline" size="sm" disabled={props.busy} onClick={props.onPortal}>
            Manage billing
            <ExternalLink className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Badge>{planLabels[state.effectivePlan]}</Badge>
          {state.plan !== state.effectivePlan && (
            <span className="text-muted-foreground text-xs">
              bought {planLabels[state.plan]}
            </span>
          )}
          {renews !== null && <span className="text-muted-foreground text-xs">{renews}</span>}
        </div>
        <p className="text-muted-foreground text-sm">
          {state.seats} seats · {limits[state.effectivePlan].apiKeys} API keys ·{" "}
          {limits[state.effectivePlan].webhookEndpoints} webhook endpoints
        </p>
        {note !== null && <p className="text-sm">{note}</p>}
      </div>

      {!state.configured && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Stripe is not configured in this deployment, so nothing can be bought here. Set{" "}
          <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code>{" "}
          to switch checkout on. Plan gating works either way — every organization is on the free
          plan until a subscription says otherwise.
        </p>
      )}

      <Separator />

      <div className="grid gap-4 sm:grid-cols-3">
        {order.map((plan) => (
          <div
            key={plan}
            className={plan === state.effectivePlan
              ? "flex flex-col gap-3 rounded-lg border-2 p-4"
              : "flex flex-col gap-3 rounded-lg border p-4"}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{planLabels[plan]}</p>
              {plan === state.effectivePlan && <Badge variant="secondary">Current</Badge>}
            </div>
            <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
              <li>{limits[plan].seats} seats</li>
              {[...features[plan]].map((feature) => (
                <li key={feature} className="flex items-center gap-1.5">
                  <Check className="size-3" aria-hidden />
                  {featureLabels[feature]}
                </li>
              ))}
            </ul>
            {plan !== "free" && plan !== state.effectivePlan && props.canManage
              && state.configured && (
              <Button
                size="sm"
                variant="outline"
                disabled={props.busy}
                onClick={() => props.onCheckout(plan)}
              >
                Choose {planLabels[plan]}
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
