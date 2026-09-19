import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import { features, limits } from "@vantion/module-iam/identity/Entitlement";
import { Check } from "lucide-react";

/**
 * The plans, read from the product rather than retyped beside it.
 *
 * This is the one part of a marketing site that lies most often: a pricing page
 * promising ten seats while the application enforces three. Here both come from
 * `@vantion/module-iam`, so a plan change is a code change in one place and
 * this page cannot disagree with what a customer actually gets.
 *
 * Prices are not in that module, because what an organization *may do* and what
 * it *costs* are different decisions — the first is enforced, the second lives
 * in Stripe. They are declared here and marked as an example.
 */
const price: Record<Plan, string> = {
  free: "Free",
  pro: "$49",
  scale: "$199",
};

const cadence: Record<Plan, string> = {
  free: "for one team",
  pro: "per month",
  scale: "per month",
};

const featureLabels = {
  api_keys: "Public API and keys",
  custom_roles: "Custom roles and per-member overrides",
  webhooks: "Outbound webhooks",
} as const;

const order: ReadonlyArray<Plan> = ["free", "pro", "scale"];

export const Pricing = () => (
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
            <p className="text-3xl font-semibold tracking-tight">{price[plan]}</p>
            <p className="text-muted-foreground text-xs">{cadence[plan]}</p>
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
