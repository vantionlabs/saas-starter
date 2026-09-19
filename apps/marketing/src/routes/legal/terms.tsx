import { meta, site } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";
import { Legal } from "@vantion/ui/marketing/legal";

const DESCRIPTION = `The agreement between you and ${site.name}.`;

export const Route = createFileRoute("/legal/terms")({
  head: () => meta({ title: "Terms", description: DESCRIPTION, path: "/legal/terms" }),
  component: () => (
    <Legal
      title="Terms"
      intro="A placeholder with the right headings. Replace the words; keep the structure, because these are the five things a customer's procurement team will look for."
      sections={[
        {
          heading: "The service",
          body: "What you are providing, and what counts as it being available.",
        },
        {
          heading: "Payment",
          body: "What a plan costs, when it renews, and what happens when a payment fails. Ours "
            + "keeps the plan on while the card is retried.",
        },
        {
          heading: "Your data",
          body: "It stays yours. Say plainly that you do not train anything on it.",
        },
        {
          heading: "Ending it",
          body: "How to cancel, what happens to the data afterwards, and how long you keep it "
            + "before it goes.",
        },
        { heading: "Liability", body: "The limits. This is the paragraph a lawyer writes." },
      ]}
    />
  ),
});
