import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import type { Feature, FeatureDetail, Question } from "@vantion/ui/marketing/hero";
import type { PlanPrice } from "@vantion/ui/marketing/pricing";

/**
 * Sample copy for the marketing and brand surfaces.
 *
 * The real words live in `apps/marketing/src/product.ts`, because copy belongs
 * to the site rather than to the design system — and a designer changing a
 * headline should not be editing a route. These are the fixtures that let the
 * same components be looked at here, the way personas do for the product.
 *
 * Deliberately long in places: a hero that only ever holds eight words is a
 * hero nobody has tested with a real sentence.
 */
export const marketing = {
  name: "Acme",
  appUrl: "https://app.acme.example",
  contact: "hello@acme.example",
  headline: "The boring parts of your B2B product, already done.",
  body: "Sign-in, organizations, roles, billing and an audit trail — so the first thing you build "
    + "is the thing you are actually selling.",
  nav: [
    { to: "/marketing", label: "Features" },
    { to: "/marketing", label: "Pricing" },
    { to: "/marketing", label: "About" },
  ],
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
      body: "It reads your data through your own permissions, and stops to ask before it writes "
        + "anything. The refusal is the feature.",
    },
  ] satisfies ReadonlyArray<Feature>,
  detail: [
    {
      title: "Teams, from the first sign-up",
      body: "Members, invitations, roles and per-member overrides are there on day one, so nobody "
        + "has to migrate off a single-user model later — a migration that touches every table.",
      points: [
        "Owner, admin and member, plus roles you define",
        "Invitations by email, with seats enforced by the plan",
        "One permission model, checked by the API and the product alike",
      ],
    },
  ] satisfies ReadonlyArray<FeatureDetail>,
  faq: [
    {
      q: "Can I export my data?",
      a: "Every record is reachable through the public API, with a key you create and revoke.",
    },
    {
      q: "What happens when a payment fails?",
      a: "Nothing, for a while. The plan stays on while the card is retried.",
    },
  ] satisfies ReadonlyArray<Question>,
  prices: {
    free: { price: "Free", cadence: "for one team" },
    pro: { price: "$49", cadence: "per month" },
    scale: { price: "$199", cadence: "per month" },
  } satisfies Record<Plan, PlanPrice>,
} as const;
