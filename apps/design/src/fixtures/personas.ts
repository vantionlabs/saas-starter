import { ContactId } from "@vantion/module-contact/ContactRpc";
import { Contact } from "@vantion/module-contact/ContactRpc";
import { CustomRole, OrganizationMember } from "@vantion/module-iam/access/AccessRpc";
import { ApiKey } from "@vantion/module-iam/apikey/ApiKey";
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
};

export const personas: ReadonlyArray<Persona> = [firstDay, settled, crowded];

export const personaById = (id: string): Persona =>
  personas.find((persona) => persona.id === id) ?? settled;
