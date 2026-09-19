import { Legal } from "@/components/legal.js";
import { meta, site } from "@/site.js";
import { createFileRoute } from "@tanstack/react-router";

const DESCRIPTION = `What ${site.name} stores, why, and how to get it back or have it deleted.`;

export const Route = createFileRoute("/legal/privacy")({
  head: () => meta({ title: "Privacy", description: DESCRIPTION, path: "/legal/privacy" }),
  component: () => (
    <Legal
      title="Privacy"
      intro="A placeholder, and an honest shape for one. Replace it with a policy your lawyer has read — but keep the headings, because they are the questions people actually ask."
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
            + "separated by row-level security in the database as well as by the application.",
        },
        {
          heading: "Getting it back",
          body: "Everything is reachable through the public API with a key you create and revoke "
            + "yourself. There is no export queue and nothing to request.",
        },
        {
          heading: "Deletion",
          body: "Deleting an organization deletes what belongs to it. Backups age out on their own "
            + "schedule — say what yours is here rather than implying it is instant.",
        },
        {
          heading: "Third parties",
          body: "Name them: the payment processor, the mail provider, the model provider if an "
            + "assistant is switched on, and anything else that sees a customer's data.",
        },
      ]}
    />
  ),
});
