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
) {}
