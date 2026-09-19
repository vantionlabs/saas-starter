import { product } from "@/product.js";
import { Pricing } from "@/sections/Pricing.js";
import { buttonVariants } from "@vantion/ui/ui/button";
import { ArrowRight } from "lucide-react";

const Hero = () => (
  <section className="flex flex-col items-start gap-6 py-16">
    <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      {product.tagline}
    </h1>
    <p className="text-muted-foreground max-w-2xl text-lg">{product.summary}</p>
    <div className="flex flex-wrap items-center gap-3">
      {
        /*
        Anchors wearing the button's classes, rather than the `Button`
        component. These navigate, so they should read as links to a screen
        reader too — Base UI's button sets `role="button"` even when rendered as
        an anchor, which is right for a control and wrong for a destination.
      */
      }
      <a href={product.appUrl} className={buttonVariants({ size: "lg" })}>
        Start free
        <ArrowRight className="size-4" aria-hidden />
      </a>
      <a href="#pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
        See pricing
      </a>
    </div>
  </section>
);

const Features = () => (
  <section className="grid gap-6 border-t py-16 md:grid-cols-3">
    {product.features.map((feature) => (
      <div key={feature.title} className="flex flex-col gap-2">
        <h2 className="font-medium">{feature.title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
      </div>
    ))}
  </section>
);

const Faq = () => (
  <section className="flex flex-col gap-6 border-t py-16">
    <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
    <dl className="grid gap-6 md:grid-cols-2">
      {product.faq.map((entry) => (
        <div key={entry.q} className="flex flex-col gap-1.5">
          <dt className="font-medium">{entry.q}</dt>
          <dd className="text-muted-foreground text-sm leading-relaxed">{entry.a}</dd>
        </div>
      ))}
    </dl>
  </section>
);

/**
 * The whole site, on one page.
 *
 * One page because that is what a product this size needs: a second one is a
 * navigation problem before it is a content problem, and every section here is
 * something a visitor would scroll to anyway.
 */
export const Site = () => (
  <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
    <header className="flex items-center justify-between py-6">
      <span className="font-medium">{product.name}</span>
      <nav className="flex items-center gap-4 text-sm">
        <a href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</a>
        <a href={product.appUrl} className="text-muted-foreground hover:text-foreground">
          Sign in
        </a>
      </nav>
    </header>

    <main className="flex-1">
      <Hero />
      <Features />
      <div className="border-t py-16">
        <Pricing />
      </div>
      <Faq />
    </main>

    <footer className="text-muted-foreground flex flex-col gap-1 border-t py-8 text-xs">
      <p>© {new Date().getFullYear()} {product.name}</p>
      <p>
        Built on the{" "}
        <a
          href="https://github.com/vantionlabs/saas-starter"
          className="underline underline-offset-2"
        >
          Vantion SaaS starter
        </a>.
      </p>
    </footer>
  </div>
);
