import type { Tenant } from "./Tenants.js";

/**
 * Who exists after a seed.
 *
 * `staff@vantion.co` is a member of nothing, deliberately: staff is a system
 * role and has nothing to do with belonging to an organization, and having one
 * account that proves it is worth more than a comment saying so.
 */
export const PEOPLE = [
  { email: "ada@acme.test", name: "Ada Lovelace" },
  { email: "grace@acme.test", name: "Grace Hopper" },
  { email: "alan@acme.test", name: "Alan Turing" },
  { email: "sam@firstday.test", name: "Sam" },
  { email: "priya@northwind.test", name: "Priya Ramachandran" },
  { email: "jean@northwind.test", name: "Jean-Baptiste Devereux-Whitmore" },
  { email: "staff@vantion.co", name: "Support" },
] as const;

/** The account made staff, so `apps/admin` opens without a SQL statement. */
export const STAFF = "staff@vantion.co";

const names = [
  "Katherine Johnson",
  "Dorothy Vaughan",
  "Mary Jackson",
  "Annie Easley",
  "Evelyn Boyd Granville",
  "Gladys West",
  "Melba Roy Mouton",
  "Christine Darden",
  "Shirley Ann Jackson",
  "Valerie Thomas",
  "Marie Van Brittan Brown",
  "Patricia Bath",
  "Alice Ball",
  "Bessie Blount Griffin",
  "Sarah Boone",
  "Miriam Benjamin",
  "Maria Beasley",
  "Margaret Knight",
  "Ellen Ochoa",
  "Jeanne Spurlock",
  "Flossie Wong-Staal",
  "Chien-Shiung Wu",
  "Tu Youyou",
  "Rosalind Franklin",
];

const contacts = (count: number, domain: string) =>
  names.slice(0, count).map((fullName) => ({
    fullName,
    email: `${fullName.toLowerCase().replace(/[^a-z]+/g, ".")}@${domain}`,
  }));

/**
 * Three tenants, matching `apps/design`'s personas so the running app and the
 * design canvas show the same three situations.
 */
export const TENANTS: ReadonlyArray<Tenant> = [
  {
    name: "First Day",
    slug: "first-day",
    owner: "sam@firstday.test",
    members: [],
    contacts: [],
    plan: "free",
    // Never subscribed, which reads differently from cancelled in the panel.
    status: "none",
    customRoles: [],
    stuckEvents: 0,
    endpoints: [],
  },
  {
    name: "Acme",
    slug: "acme",
    owner: "ada@acme.test",
    members: [
      { email: "grace@acme.test", role: "admin" },
      { email: "alan@acme.test", role: "member" },
    ],
    contacts: contacts(6, "acme.test"),
    plan: "pro",
    status: "active",
    customRoles: [{ role: "support", permissions: ["contact:read", "member:read"] }],
    stuckEvents: 0,
    endpoints: [{ url: "https://acme.test/hooks/vantion", active: true, failures: 0 }],
  },
  {
    name: "Northwind Industries International",
    slug: "northwind-industries-international",
    owner: "priya@northwind.test",
    members: [{ email: "jean@northwind.test", role: "admin" }],
    contacts: contacts(24, "northwind-industries.example"),
    plan: "scale",
    /**
     * Past due, and still entitled — which is the product's own rule and the
     * one people find surprising, so the seed shows it rather than describing
     * it.
     */
    status: "past_due",
    customRoles: [
      { role: "auditor", permissions: ["member:read", "billing:read"] },
      { role: "integrator", permissions: ["contact:read", "contact:create", "file:create"] },
    ],
    // A backed-up outbox and a dead endpoint: the two things the admin panel's
    // health counts exist to explain.
    stuckEvents: 4,
    endpoints: [
      { url: "https://northwind-industries.example/hooks", active: true, failures: 0 },
      { url: "https://gone.northwind-industries.example/hooks", active: false, failures: 10 },
    ],
  },
];
