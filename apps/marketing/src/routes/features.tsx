import { product } from "@/product.js";
import { meta } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";

const DESCRIPTION =
  "Teams, tenant isolation you can show a reviewer, a public API, background jobs, outbound "
  + "webhooks and an assistant that asks before it writes.";

const Features = () => (
  <div className="flex flex-col gap-12 py-16">
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">What it does</h1>
      <p className="text-muted-foreground max-w-2xl">{DESCRIPTION}</p>
    </div>

    <div className="flex flex-col gap-10">
      {product.detail.map((group) => (
        <section key={group.title} className="flex flex-col gap-3 border-t pt-10">
          <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{group.body}</p>
          <ul className="text-muted-foreground grid gap-2 pt-2 text-sm sm:grid-cols-2">
            {group.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
      ))}
    </div>
  </div>
);

export const Route = createFileRoute("/features")({
  head: () => meta({ title: "Features", description: DESCRIPTION, path: "/features" }),
  component: Features,
});
