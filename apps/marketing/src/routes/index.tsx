import { product } from "@/product.js";
import { meta, site } from "@/site.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@vantion/ui/ui/button";
import { ArrowRight } from "lucide-react";

const Home = () => (
  <>
    <section className="flex flex-col items-start gap-6 py-16">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {site.tagline}
      </h1>
      <p className="text-muted-foreground max-w-2xl text-lg">{site.description}</p>
      <div className="flex flex-wrap items-center gap-3">
        {
          /*
          Anchors wearing the button's classes rather than the `Button`
          component: these navigate, so they should read as links to a screen
          reader too. Base UI's button sets `role="button"` even when rendered
          as an anchor, which is right for a control and wrong for a destination.
        */
        }
        <a href={site.appUrl} className={buttonVariants({ size: "lg" })}>
          Start free
          <ArrowRight className="size-4" aria-hidden />
        </a>
        <Link to="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
          See pricing
        </Link>
      </div>
    </section>

    <section className="grid gap-6 border-t py-16 md:grid-cols-3">
      {product.features.map((feature) => (
        <div key={feature.title} className="flex flex-col gap-2">
          <h2 className="font-medium">{feature.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
        </div>
      ))}
    </section>

    <section className="flex flex-col items-start gap-4 border-t py-16">
      <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
      <dl className="grid w-full gap-6 md:grid-cols-2">
        {product.faq.map((entry) => (
          <div key={entry.q} className="flex flex-col gap-1.5">
            <dt className="font-medium">{entry.q}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">{entry.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  </>
);

export const Route = createFileRoute("/")({
  head: () => meta({ title: "Home", description: site.description, path: "/" }),
  component: Home,
});
