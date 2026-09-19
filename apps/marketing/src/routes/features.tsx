import { product } from "@/product.js";
import { meta } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureDetails } from "@vantion/ui/marketing/hero";

const DESCRIPTION =
  "Teams, tenant isolation you can show a reviewer, a public API, background jobs, outbound "
  + "webhooks and an assistant that asks before it writes.";

const Features = () => (
  <div className="flex flex-col gap-12 py-16">
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">What it does</h1>
      <p className="text-muted-foreground max-w-2xl">{DESCRIPTION}</p>
    </div>

    <FeatureDetails groups={product.detail} />
  </div>
);

export const Route = createFileRoute("/features")({
  head: () => meta({ title: "Features", description: DESCRIPTION, path: "/features" }),
  component: Features,
});
