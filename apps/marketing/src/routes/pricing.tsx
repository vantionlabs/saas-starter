import { Pricing } from "@/sections/pricing.js";
import { meta, site } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";
import { buttonVariants } from "@vantion/ui/ui/button";

const DESCRIPTION =
  "Three plans, and every limit on this page is the one the product enforces — read from the "
  + "same declaration the application authorises against.";

const PricingPage = () => (
  <div className="flex flex-col gap-10 py-16">
    <Pricing />

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
