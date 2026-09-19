import { meta, site } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";
import { Pricing } from "@vantion/ui/marketing/pricing";
import { buttonVariants } from "@vantion/ui/ui/button";

/**
 * What each plan costs.
 *
 * Here rather than in `@vantion/module-iam`, because a price is not something
 * the application enforces — the limits are, and those the section reads from
 * the product itself.
 */
const prices = {
  free: { price: "Free", cadence: "for one team" },
  pro: { price: "$49", cadence: "per month" },
  scale: { price: "$199", cadence: "per month" },
} as const;

const DESCRIPTION =
  "Three plans, and every limit on this page is the one the product enforces — read from the "
  + "same declaration the application authorises against.";

const PricingPage = () => (
  <div className="flex flex-col gap-10 py-16">
    <Pricing prices={prices} />

    <div className="flex flex-wrap items-center gap-3 border-t pt-10">
      <a href={site.appUrl} className={buttonVariants({ size: "lg" })}>Start on the free plan</a>
      <p className="text-muted-foreground text-sm">No card, and no trial to forget to cancel.</p>
    </div>
  </div>
);

export const Route = createFileRoute("/pricing")({
  head: () => meta({ title: "Pricing", description: DESCRIPTION, path: "/pricing" }),
  component: PricingPage,
});
