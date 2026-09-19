/**
 * What this site is selling.
 *
 * One file, because a marketing site that scatters its claims across twenty
 * components is one nobody can change without reading all of them. Replace
 * every string here and the page is yours.
 *
 * Pricing is deliberately absent: it is read from the product's own plans, so
 * this page cannot promise a limit the application does not enforce.
 */
export const product = {
  name: "Acme",
  tagline: "The boring parts of your B2B product, already done.",
  summary:
    "Sign-in, organizations, roles, billing and an audit trail — so the first thing you build "
    + "is the thing you are actually selling.",
  /** Where the sign-up button goes. The application's own address. */
  appUrl: "http://localhost:5173",
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
