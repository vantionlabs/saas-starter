import { Message } from "@vantion/module-assistant/AssistantRpc";
import { BillingState } from "@vantion/module-billing/BillingRpc";
import { ContactId } from "@vantion/module-contact/ContactRpc";
import { Contact } from "@vantion/module-contact/ContactRpc";
import { CustomRole, OrganizationMember } from "@vantion/module-iam/access/AccessRpc";
import { ApiKey } from "@vantion/module-iam/apikey/ApiKey";
import type { PersonView } from "@vantion/ui/admin/person-card";
import type { StaffTrailRow } from "@vantion/ui/admin/staff-trail-table";
import type { SsoProviderRow } from "@vantion/ui/settings/sso-panel";
import { DateTime } from "effect";

/**
 * Who the screens are being designed for.
 *
 * A persona here is not a card on a wall — it is a whole tenant's worth of data,
 * chosen so that the screens are seen under the conditions that actually break
 * them. Real design decisions are made on the crowded case and the empty one,
 * and a screenshot of three tidy rows tells you nothing about either.
 */
export type Persona = {
  readonly id: string;
  readonly name: string;
  readonly describes: string;
  readonly workspace: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly contacts: ReadonlyArray<Contact>;
  readonly members: ReadonlyArray<OrganizationMember>;
  readonly roles: ReadonlyArray<CustomRole>;
  readonly apiKeys: ReadonlyArray<ApiKey>;
  readonly billing: BillingState;
  readonly conversation: ReadonlyArray<Message>;
  readonly sso: ReadonlyArray<SsoProviderRow>;
  /**
   * The staff trail, which belongs to `apps/admin` rather than to this tenant.
   *
   * It is on a persona anyway because its states are the same three: nothing
   * recorded, an ordinary week, and the crowded case where a reason runs long
   * enough to decide the column widths. A staff surface with no design is the
   * one whose mistakes are least visible and most expensive.
   */
  readonly staffTrail: ReadonlyArray<StaffTrailRow>;
  /** The result of a staff lookup, for the admin panel's person screen. */
  readonly person: PersonView;
};

const at = (iso: string) => DateTime.makeUnsafe(new Date(iso));

const contact = (id: string, fullName: string, email: string) =>
  new Contact({ id: ContactId.make(id), fullName, email });

/** Day one. Every list is empty, which is the state most designs forget. */
const firstDay: Persona = {
  id: "first-day",
  name: "First day",
  describes: "Signed up ten minutes ago. Nothing exists yet.",
  workspace: "acme",
  email: "sam@acme.test",
  emailVerified: false,
  contacts: [],
  members: [new OrganizationMember({ memberId: "m1", email: "sam@acme.test", role: "owner" })],
  roles: [],
  apiKeys: [],
  billing: new BillingState({
    plan: "free",
    effectivePlan: "free",
    status: "active",
    seats: 3,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    // The fresh-clone state: no Stripe keys, so the screen has to explain
    // itself rather than offer a button that fails.
    configured: false,
    manageable: false,
  }),
  conversation: [
    new Message({
      id: "m-user",
      role: "user",
      text: "Who have we not spoken to since the spring?",
      toolName: null,
      createdAt: "2026-09-18T09:00:00.000Z",
    }),
    new Message({
      id: "m-tool",
      role: "tool",
      text: "SearchContacts",
      toolName: "SearchContacts",
      createdAt: "2026-09-18T09:00:01.000Z",
    }),
    new Message({
      id: "m-answer",
      role: "assistant",
      text: "Three contacts have had no activity since March. Grace Hopper is not in your "
        + "contacts at all — shall I add her?",
      toolName: null,
      createdAt: "2026-09-18T09:00:03.000Z",
    }),
  ],
  sso: [],
  staffTrail: [],
  person: {
    id: "usr_first",
    email: "sam@acme.test",
    name: "Sam",
    emailVerified: false,
    banned: false,
    staff: false,
    createdAt: "2026-09-19T09:55:00.000Z",
    // Signed up and never finished, which is a real state rather than an error.
    memberships: [],
  },
};

/** The ordinary case, and the one most screenshots are taken of. */
const settled: Persona = {
  id: "settled",
  name: "Settled team",
  describes: "A few months in. Enough data to look like a product.",
  workspace: "northwind",
  email: "ada@northwind.test",
  emailVerified: true,
  contacts: [
    contact("c1", "Grace Hopper", "grace@navy.test"),
    contact("c2", "Alan Turing", "alan@bletchley.test"),
    contact("c3", "Katherine Johnson", "katherine@nasa.test"),
  ],
  members: [
    new OrganizationMember({ memberId: "m1", email: "ada@northwind.test", role: "owner" }),
    new OrganizationMember({ memberId: "m2", email: "charles@northwind.test", role: "admin" }),
    new OrganizationMember({ memberId: "m3", email: "mary@northwind.test", role: "member" }),
  ],
  roles: [new CustomRole({ role: "support", permissions: ["contact:read", "member:read"] })],
  apiKeys: [
    new ApiKey({
      id: "k1",
      name: "CI",
      hint: "a41f…",
      role: "member",
      createdAt: at("2026-06-02T09:00:00Z"),
      lastUsedAt: at("2026-09-17T22:14:00Z"),
    }),
  ],
  billing: new BillingState({
    plan: "pro",
    effectivePlan: "pro",
    status: "active",
    seats: 25,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    configured: true,
    manageable: true,
  }),
  conversation: [
    new Message({
      id: "m-user",
      role: "user",
      text: "Who have we not spoken to since the spring?",
      toolName: null,
      createdAt: "2026-09-18T09:00:00.000Z",
    }),
    new Message({
      id: "m-tool",
      role: "tool",
      text: "SearchContacts",
      toolName: "SearchContacts",
      createdAt: "2026-09-18T09:00:01.000Z",
    }),
    new Message({
      id: "m-answer",
      role: "assistant",
      text: "Three contacts have had no activity since March. Grace Hopper is not in your "
        + "contacts at all — shall I add her?",
      toolName: null,
      createdAt: "2026-09-18T09:00:03.000Z",
    }),
  ],
  sso: [
    {
      providerId: "acme-okta",
      domain: "acme.com",
      issuer: "https://acme.okta.com",
      domainVerified: true,
    },
  ],
  staffTrail: [
    {
      id: "t1",
      staffEmail: "support@vantion.co",
      action: "GetOrganization",
      organizationId: "org_8fc2",
      reason: "SUP-4821",
      at: "2026-09-18T14:02:11.000Z",
    },
    {
      id: "t2",
      staffEmail: "support@vantion.co",
      // The widest thing anybody can do here, and the row that has to look it.
      action: "ListOrganizations",
      organizationId: undefined,
      reason: "SUP-4821",
      at: "2026-09-18T14:01:48.000Z",
    },
  ],
  person: {
    id: "usr_settled",
    email: "ada@acme.test",
    name: "Ada Lovelace",
    emailVerified: true,
    banned: false,
    staff: false,
    createdAt: "2026-04-02T10:12:00.000Z",
    memberships: [
      { organizationId: "org_8fc2", name: "Acme", slug: "acme", role: "owner" },
    ],
  },
};

/**
 * The case that breaks layouts: long names, long addresses, many rows.
 *
 * Designing against `settled` alone produces a table that is beautiful until a
 * customer with a real company name signs up.
 */
const crowded: Persona = {
  id: "crowded",
  name: "Crowded",
  describes: "Long names, many rows. The state that breaks a layout.",
  workspace: "internationale-handelsgesellschaft",
  email: "administrator@internationale-handelsgesellschaft.test",
  emailVerified: true,
  contacts: Array.from({ length: 24 }, (_, index) =>
    contact(
      `c${index}`,
      index % 3 === 0
        ? "Bartholomew Featherstonehaugh-Cholmondeley"
        : `Contact Number ${index + 1}`,
      `person.number.${index + 1}@internationale-handelsgesellschaft.test`,
    )),
  members: Array.from({ length: 9 }, (_, index) =>
    new OrganizationMember({
      memberId: `m${index}`,
      email: `member.number.${index + 1}@internationale-handelsgesellschaft.test`,
      role: index === 0 ? "owner" : index < 3 ? "admin" : "member",
    })),
  roles: [
    new CustomRole({ role: "support", permissions: ["contact:read", "member:read"] }),
    new CustomRole({
      role: "billing-administrator",
      permissions: ["organization:update", "member:read", "member:update"],
    }),
  ],
  apiKeys: Array.from({ length: 6 }, (_, index) =>
    new ApiKey({
      id: `k${index}`,
      name: `Integration number ${index + 1}`,
      hint: `${index}b7c…`,
      role: index % 2 === 0 ? "member" : "admin",
      createdAt: at("2026-03-11T09:00:00Z"),
      lastUsedAt: index % 3 === 0 ? null : at("2026-09-18T08:00:00Z"),
    })),
  /**
   * A card that failed on the biggest customer, which is when the screen has
   * to be clearest: the plan is still on, the message says why, and the button
   * that fixes it is the one thing on the page that matters.
   */
  billing: new BillingState({
    plan: "scale",
    effectivePlan: "scale",
    status: "past_due",
    seats: 250,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: "2026-10-04T00:00:00.000Z",
    configured: true,
    manageable: true,
  }),
  conversation: [
    new Message({
      id: "m-user",
      role: "user",
      text: "Who have we not spoken to since the spring?",
      toolName: null,
      createdAt: "2026-09-18T09:00:00.000Z",
    }),
    new Message({
      id: "m-tool",
      role: "tool",
      text: "SearchContacts",
      toolName: "SearchContacts",
      createdAt: "2026-09-18T09:00:01.000Z",
    }),
    new Message({
      id: "m-answer",
      role: "assistant",
      text: "Three contacts have had no activity since March. Grace Hopper is not in your "
        + "contacts at all — shall I add her?",
      toolName: null,
      createdAt: "2026-09-18T09:00:03.000Z",
    }),
  ],
  /**
   * One live and one still waiting on DNS, because that pair is the state
   * the screen has to explain and the one a designer cannot reach without
   * owning two domains.
   */
  sso: [
    {
      providerId: "northwind-entra",
      domain: "northwind-industries.example",
      issuer: "https://login.microsoftonline.com/8f4c2c1e-0b7a-4c5d-9f2e-6a1b3c4d5e6f/v2.0",
      domainVerified: true,
    },
    {
      providerId: "northwind-okta",
      domain: "northwind.example",
      issuer: "https://northwind.okta.com",
      domainVerified: false,
    },
  ],
  /**
   * The case that decides the column widths: a reason somebody actually typed
   * rather than a ticket number, two staff working the same afternoon, and a
   * read of every tenant sitting beside reads of one.
   */
  staffTrail: [
    {
      id: "t1",
      staffEmail: "priya.ramachandran@vantion.co",
      action: "GetOrganization",
      organizationId: "org_3f9a71c4e88b",
      reason: "Customer reports their CSV import stalled at 900 of 2400 rows — ZD-118204",
      at: "2026-09-19T11:47:03.000Z",
    },
    {
      id: "t2",
      staffEmail: "priya.ramachandran@vantion.co",
      action: "ListOrganizations",
      organizationId: undefined,
      reason: "Finding the tenant for ZD-118204; customer gave a domain, not a slug",
      at: "2026-09-19T11:46:20.000Z",
    },
    {
      id: "t3",
      staffEmail: "sam@vantion.co",
      action: "GetOrganization",
      organizationId: "org_0011aa22bb33",
      reason: "ZD-118199",
      at: "2026-09-19T09:15:55.000Z",
    },
    {
      id: "t4",
      staffEmail: "sam@vantion.co",
      action: "GetOrganization",
      organizationId: "org_deleted_last_week",
      // A stale link, which is a real row and the kind worth reviewing.
      reason: "ZD-118188 — following a link from an old ticket",
      at: "2026-09-19T09:14:02.000Z",
    },
  ],
  /**
   * Somebody in four organizations at once, which is the case that decides
   * whether this screen is a card or a table — a consultant working across
   * several customers is exactly who support ends up looking up.
   */
  person: {
    id: "usr_3f9a71c4e88b0011aa22",
    email: "priya.ramachandran@northwind-industries.example",
    name: "Priya Ramachandran",
    emailVerified: true,
    banned: false,
    staff: false,
    createdAt: "2025-11-14T08:03:00.000Z",
    memberships: [
      {
        organizationId: "org_3f9a71c4e88b",
        name: "Northwind Industries International",
        slug: "northwind-industries-international",
        role: "owner",
      },
      { organizationId: "org_0011aa22bb33", name: "Contoso", slug: "contoso", role: "admin" },
      { organizationId: "org_44cc55dd66ee", name: "Fabrikam", slug: "fabrikam", role: "member" },
      {
        organizationId: "org_77ff88aa99bb",
        name: "Tailspin Toys",
        slug: "tailspin",
        role: "member",
      },
    ],
  },
};

export const personas: ReadonlyArray<Persona> = [firstDay, settled, crowded];

export const personaById = (id: string): Persona =>
  personas.find((persona) => persona.id === id) ?? settled;
