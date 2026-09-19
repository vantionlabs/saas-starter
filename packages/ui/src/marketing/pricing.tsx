import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import { features, limits } from "@vantion/module-iam/identity/Entitlement";
import { Check } from "lucide-react";

/**
 * The plans, read from the product rather than retyped beside them.
 *
 * This is the one part of a marketing site that lies most often: a pricing page
 * promising ten seats while the application enforces three. The limits and
 * features here come from `@vantion/module-iam`, so a plan change is one edit
 * and this cannot disagree with what a customer actually gets.
 *
 * Prices arrive as props, because what an organization *may do* and what it
 * *costs* are different decisions — the first is enforced in code, the second
 * lives in Stripe and on the site.
 */
export type PlanPrice = { readonly price: string; readonly cadence: string; };

const featureLabels = {
  api_keys: "Public API and keys",
  custom_roles: "Custom roles and per-member overrides",
  webhooks: "Outbound webhooks",
} as const;

const order: ReadonlyArray<Plan> = ["free", "pro", "scale"];

export const Pricing = (props: {
  readonly prices: Record<Plan, PlanPrice>;
}) => (
  <section id="pricing" className="flex flex-col gap-8">
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
      <p className="text-muted-foreground max-w-2xl">
        Every limit below is the one the product enforces. They are read from the same declaration
        the application authorises against.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      {order.map((plan) => (
        <div key={plan} className="bg-card flex flex-col gap-4 rounded-lg border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium capitalize">{plan}</p>
            <p className="text-3xl font-semibold tracking-tight">{props.prices[plan].price}</p>
            <p className="text-muted-foreground text-xs">{props.prices[plan].cadence}</p>
          </div>

          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li>{limits[plan].seats} seats</li>
            <li>{limits[plan].apiKeys} API keys</li>
            <li>{limits[plan].storageMb.toLocaleString("en")} MB of files</li>
            {[...features[plan]].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="size-3.5 shrink-0" aria-hidden />
                {featureLabels[feature]}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </section>
);
