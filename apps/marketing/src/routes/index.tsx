import { product } from "@/product.js";
import { meta, site } from "@/site.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Faq, FeatureGrid, Hero } from "@vantion/ui/marketing/hero";
import { buttonVariants } from "@vantion/ui/ui/button";
import { ArrowRight } from "lucide-react";

const Home = () => (
  <>
    <Hero
      headline={site.tagline}
      body={site.description}
      actions={
        <>
          {
            /*
            Anchors wearing the button's classes rather than the `Button`
            component: these navigate, so they should read as links to a screen
            reader too. Base UI's button sets `role="button"` even when rendered
            as an anchor, which is right for a control and wrong for a
            destination.
          */
          }
          <a href={site.appUrl} className={buttonVariants({ size: "lg" })}>
            Start free
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <Link to="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
            See pricing
          </Link>
        </>
      }
    />

    <FeatureGrid features={product.features} />

    <Faq heading="Questions" questions={product.faq} />
  </>
);

export const Route = createFileRoute("/")({
  head: () => meta({ title: "Home", description: site.description, path: "/" }),
  component: Home,
});
