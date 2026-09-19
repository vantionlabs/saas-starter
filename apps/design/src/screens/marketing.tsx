import { marketing } from "@/fixtures/site.js";
import { Faq, FeatureDetails, FeatureGrid, Hero } from "@vantion/ui/marketing/hero";
import { Legal } from "@vantion/ui/marketing/legal";
import { Pricing } from "@vantion/ui/marketing/pricing";
import { buttonVariants } from "@vantion/ui/ui/button";

/**
 * The marketing surface, on the same canvas as the product.
 *
 * The site itself is server-rendered and lives in `apps/marketing`; what is
 * here are its sections, from `@vantion/ui/marketing`, against fixture copy —
 * so a designer works on one app rather than three, and `/figma-screen` has one
 * source for every surface.
 *
 * The shell is not rendered: it is a header and footer around a router that
 * belongs to the site, and this app has its own.
 */
export const Marketing = () => (
  <div className="flex flex-col gap-10">
    <Hero
      headline={marketing.headline}
      body={marketing.body}
      actions={
        <>
          <a href={marketing.appUrl} className={buttonVariants({ size: "lg" })}>Start free</a>
          <a href="#pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
            See pricing
          </a>
        </>
      }
    />

    <FeatureGrid features={marketing.features} />

    <Pricing prices={marketing.prices} />

    <FeatureDetails groups={marketing.detail} />

    <Faq heading="Questions" questions={marketing.faq} />

    <Legal
      title="Privacy"
      intro="The legal pages, which are mostly typography under pressure: long prose, short line length, and headings somebody can scan for the one answer they came for."
      sections={[
        {
          heading: "What is stored",
          body: "The account you create, the organization it belongs to, and whatever you put into "
            + "the product. Every write is recorded in an audit trail you can read at any time.",
        },
        {
          heading: "Who can see it",
          body:
            "Members of your own organization, according to the role you give them. Tenants are "
            + "separated by row-level security as well as by the application.",
        },
      ]}
    />
  </div>
);
