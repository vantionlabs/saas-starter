import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { ReasonRequired } from "./CrossTenant.js";
import { NotStaff } from "./StaffResolver.js";

/**
 * Why this request is being made.
 *
 * On the payload of every procedure rather than resolved from a header or a
 * session, because it differs per request: one support engineer looking at two
 * customers in an afternoon is doing so for two different reasons, and a value
 * carried by the session would record the first one twice.
 */
const Reason = Schema.String.annotate({
  identifier: "Reason",
  description: "Why this data is being read — a ticket reference, not a sentence.",
});

export class OrganizationSummary extends Schema.Class<OrganizationSummary>("OrganizationSummary")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  members: Schema.Number,
  /** What they are on, which is the first thing anybody asks. */
  plan: Schema.String,
  createdAt: Schema.String,
}) {}

/**
 * Counts, never contents.
 *
 * A support engineer answering "is their import stuck" needs to know there are
 * nine hundred contacts, not who they are. Whatever this returns is read across
 * the tenant boundary, so the bar for adding a field is what a person cannot do
 * their job without — and every one of them is in the audit record by name.
 */
export class OrganizationDetail extends Schema.Class<OrganizationDetail>("OrganizationDetail")({
  organization: OrganizationSummary,
  contacts: Schema.Number,
  files: Schema.Number,
  apiKeys: Schema.Number,
  webhookEndpoints: Schema.Number,
}) {}

/**
 * A link to an organization that is no longer there.
 *
 * Typed rather than a defect. The panel lists organizations and links into
 * them, one can be deleted between the two, and a staff member following a
 * stale link is an ordinary outcome a screen should render — not a crash. It
 * says nothing either way about whether the id ever existed, which costs
 * nothing here: staff may see every organization, so there is no set of ids to
 * probe for.
 */
export class OrganizationNotFound
  extends Schema.TaggedError<OrganizationNotFound>()("OrganizationNotFound", {})
{}

/**
 * One line of the staff trail.
 *
 * The only procedure here that returns *contents* rather than counts, and the
 * exception proves the rule: every field is something a staff member typed or
 * something the system recorded about them. There is no customer data in it —
 * `organizationId` is an identifier a reviewer follows, not a name, an address
 * or a row belonging to anybody.
 *
 * `staffEmail` rather than `staffUserId` alone, because the table stores both
 * and a review nobody can read at a glance is a review nobody does.
 */
export class StaffTrailEntry extends Schema.Class<StaffTrailEntry>("StaffTrailEntry")({
  id: Schema.String,
  staffEmail: Schema.String,
  action: Schema.String,
  /** Absent when the action concerned every tenant, such as listing them all. */
  organizationId: Schema.optional(Schema.String),
  reason: Schema.String,
  at: Schema.String,
}) {}

/** One organization this person belongs to, and what they are in it. */
export class PersonMembership extends Schema.Class<PersonMembership>("PersonMembership")({
  organizationId: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  role: Schema.String,
}) {}

/**
 * A person, found by their exact address.
 *
 * The one read here organized by human rather than by tenant, because that is
 * how a support ticket arrives. It carries no customer *data* — no contacts, no
 * files, no counts — only who this account is and where it belongs, which is
 * what decides where to look next.
 */
export class PersonProfile extends Schema.Class<PersonProfile>("PersonProfile")({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
  emailVerified: Schema.Boolean,
  banned: Schema.Boolean,
  /** Whether this account is staff. The one field that is about us. */
  staff: Schema.Boolean,
  createdAt: Schema.String,
  memberships: Schema.Array(PersonMembership),
}) {}

/**
 * No account with that address.
 *
 * Typed rather than a defect, and it says exactly as much as it should: a
 * caller who already knows the address learns whether it is a customer, which
 * is the question they asked. Staff may look up anybody, so there is nothing
 * narrower to protect here — and the attempt is recorded either way.
 */
export class PersonNotFound extends Schema.TaggedError<PersonNotFound>()("PersonNotFound", {}) {}

export class AdminRpcs extends RpcGroup.make(
  Rpc.make("ListOrganizations", {
    payload: { reason: Reason },
    success: Schema.Array(OrganizationSummary),
    error: Schema.Union([NotStaff, ReasonRequired]),
  }),
  Rpc.make("GetOrganization", {
    payload: { organizationId: Schema.String, reason: Reason },
    success: OrganizationDetail,
    error: Schema.Union([NotStaff, ReasonRequired, OrganizationNotFound]),
  }),
  /**
   * The trail, and the one procedure here that takes **no reason**.
   *
   * Every other one reads a customer's data and has to say why. This reads what
   * staff have been doing, which is oversight rather than access — charging a
   * ticket number for checking on your colleagues is how the checking stops.
   * `StaffTrail.ts` has the argument at length, including why it would
   * otherwise record itself.
   *
   * `ReasonRequired` is therefore absent from the error channel, which is the
   * compiler carrying the decision rather than a comment asking for it.
   */
  /**
   * Looked up by **exact** address. The payload has no room for a pattern,
   * which is deliberate: a prefix search across every tenant would be an
   * enumeration tool wearing a support screen's clothes.
   */
  Rpc.make("FindPerson", {
    payload: { email: Schema.String, reason: Reason },
    success: PersonProfile,
    error: Schema.Union([NotStaff, ReasonRequired, PersonNotFound]),
  }),
  Rpc.make("ListStaffTrail", {
    payload: {
      /**
       * Bounded in the schema rather than by the query, so a client cannot ask
       * for the whole table and the limit is part of the contract both ends
       * compile against.
       */
      limit: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 200 })),
    },
    success: Schema.Array(StaffTrailEntry),
    error: NotStaff,
  }),
) {}
