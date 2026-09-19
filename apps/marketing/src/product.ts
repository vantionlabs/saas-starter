/**
 * What this site is selling, in its own words.
 *
 * One file, because a marketing site that scatters its claims across twenty
 * components is one nobody can change without reading all of them. The site's
 * *facts* — its name, URL and contact address — are in `site.ts`, because the
 * metadata and the sitemap need them too.
 *
 * Pricing is deliberately absent: it is read from the product's own plans, so
 * this page cannot promise a limit the application does not enforce.
 */
export const product = {
  features: [
    {
      title: "Teams from day one",
      body: "Every account is an organization with members, invitations and roles. Nobody has to "
        + "migrate off a single-user model six months in.",
    },
    {
      title: "Isolation you can show a reviewer",
      body: "Tenants are separated by row-level security and by every query that touches them. "
        + "Two real users prove it in the test suite, not in a diagram.",
    },
    {
      title: "An assistant that asks first",
      body: "It reads your data through your own permissions, and it stops to ask before it writes "
        + "anything. The refusal is the feature.",
    },
  ],
  /** The features page, which has room to say more than three lines each. */
  detail: [
    {
      title: "Teams, from the first sign-up",
      body: "Every account is an organization. Members, invitations, roles and per-member "
        + "overrides are there on day one, so nobody has to migrate off a single-user model "
        + "six months in — which is a migration that touches every table you have.",
      points: [
        "Owner, admin and member, plus roles you define",
        "Invitations by email, with seats enforced by the plan",
        "One permission model, checked by the API and the product alike",
        "A personal organization for every new account, so there is no orgless state",
      ],
    },
    {
      title: "Isolation you can show a reviewer",
      body: "Tenants are separated twice: row-level security in Postgres, and an explicit "
        + "organization filter on every query that touches a tenant-owned table. Neither is "
        + "trusted alone, because a superuser ignores the first and a mistake defeats the "
        + "second.",
      points: [
        "Row-level security on every tenant-owned table",
        "Two real users prove it in the browser test suite",
        "An audit trail of who did what, readable in the product",
        "API keys that act as a role, not as a person",
      ],
    },
    {
      title: "The parts nobody demos",
      body: "Billing, background jobs, outbound webhooks and file storage — the four things every "
        + "product rebuilds in its second month, already here and already tested.",
      points: [
        "Stripe checkout, the billing portal and plan entitlements",
        "A transactional outbox, so a job cannot fire for a write that rolled back",
        "Signed, retried webhooks your customers can verify",
        "Uploads straight to storage, with links that expire",
      ],
    },
    {
      title: "An assistant that asks first",
      body: "It answers from your organization's own records, through the same permissions you "
        + "have, and it stops to ask before it writes anything. The refusal is the feature: a "
        + "model that misreads an instruction is acting entirely within its permissions while "
        + "doing the wrong thing.",
      points: [
        "Reads through your permissions, never around them",
        "Every write proposed, and performed only once approved",
        "Every action recorded in the same audit trail",
        "The same tools available to your editor over MCP",
      ],
    },
  ],
  faq: [
    {
      q: "Can I export my data?",
      a: "Every record is reachable through the public API, authenticated by a key you create "
        + "and revoke yourself.",
    },
    {
      q: "What happens when a payment fails?",
      a: "Nothing, for a while. A card that failed this morning usually succeeds this "
        + "afternoon, so the plan stays on while it is retried.",
    },
    {
      q: "Is my data used to train anything?",
      a: "No. The assistant reads your organization's records to answer your question and "
        + "nothing else keeps them.",
    },
  ],
} as const;
