import { ContactStore } from "@vantion/module-contact/ContactStore";
import { CurrentEntitlement } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { Schema } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import { SqlClient } from "effect/unstable/sql";

/**
 * What a model — or an MCP client — may do with this application.
 *
 * These are declarations only: a name, a description and schemas. The handlers
 * are in `ToolkitLive.ts`, and they are the *same stores* the RPC handlers and
 * the public API call. That is the whole design. A tool is a fourth transport
 * over one implementation, not a fourth implementation.
 *
 * The descriptions are written for a reader who cannot see the schema, because
 * that reader is a language model choosing between tools. "Search contacts" is
 * a name; what belongs here is when to reach for it and what it will not do.
 */

export class ContactSummary extends Schema.Class<ContactSummary>("ContactSummary")({
  id: Schema.String,
  email: Schema.String,
  fullName: Schema.String,
}) {}

export class Caller extends Schema.Class<Caller>("Caller")({
  email: Schema.String,
  organizationId: Schema.String,
  role: Schema.String,
  plan: Schema.String,
  /** What this caller may do, so a model can decline before being refused. */
  permissions: Schema.Array(Schema.String),
}) {}

export class FileSummary extends Schema.Class<FileSummary>("FileSummary")({
  id: Schema.String,
  name: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
}) {}

/**
 * A refusal, as a value rather than a defect.
 *
 * Tool failures come back to the model as text it can act on: "you may not do
 * that" is something it should tell the person and stop, not something the
 * process should die of. The permission that was missing is named, because a
 * model that knows what it lacked can say so precisely.
 */
export class ToolRefused extends Schema.TaggedError<ToolRefused>()("ToolRefused", {
  required: Schema.String,
}) {}

/**
 * A refusal comes back as a *result*, not as a failed call.
 *
 * `failureMode: "error"` would put it in the effect's error channel, which ends
 * the turn — so a model that reached for one tool it may not use would be cut
 * off mid-answer instead of saying "you do not have permission for that" and
 * carrying on with what it can do. An MCP client wants the same thing: a
 * refusal it can show, not a protocol error.
 */
const returnsRefusals = { failure: ToolRefused, failureMode: "return" } as const;

export const WhoAmI = Tool.make("WhoAmI", {
  description:
    "Identify the current caller: their email, organization, role, plan and permissions. "
    + "Call this first when a request depends on who is asking or on what they are allowed to do.",
  success: Caller,
  ...returnsRefusals,
  /**
   * What the handler may reach for. Declared on the tool rather than inferred
   * from the handler, so the toolkit's layer states its requirements the same
   * way every other layer here does — and an application that has not
   * registered the contact module cannot accidentally expose a contact tool.
   */
  dependencies: [CurrentUser, CurrentEntitlement],
});

export const ListContacts = Tool.make("ListContacts", {
  description: "List every contact belonging to the caller's organization, newest first. "
    + "Returns only this organization's contacts; there is no way to reach another's.",
  success: Schema.Array(ContactSummary),
  ...returnsRefusals,
  dependencies: [ContactStore, CurrentUser],
});

export const SearchContacts = Tool.make("SearchContacts", {
  description: "Find contacts in the caller's organization whose name or email contains the query. "
    + "Case-insensitive substring matching, not semantic search.",
  parameters: Schema.Struct({
    query: Schema.String.check(Schema.isNonEmpty()),
  }),
  success: Schema.Array(ContactSummary),
  ...returnsRefusals,
  dependencies: [ContactStore, CurrentUser],
});

export const CreateContact = Tool.make("CreateContact", {
  description:
    "Add a contact to the caller's organization. This writes to the product and is recorded "
    + "in the audit trail against the caller. Confirm the email and name with the person "
    + "before calling it.",
  parameters: Schema.Struct({
    email: Schema.String.check(Schema.isNonEmpty()),
    fullName: Schema.String.check(Schema.isNonEmpty()),
  }),
  success: ContactSummary,
  ...returnsRefusals,
  dependencies: [ContactStore, CurrentUser],
  /**
   * The approval gate, and it is the model's own machinery rather than
   * something bolted on: a tool marked this way is proposed to the caller and
   * executed only once they say yes.
   *
   * Every write here carries it. The permission check already decides whether
   * this person *may* add a contact; approval decides whether they meant to,
   * and those are different questions — a model that misreads an instruction is
   * acting entirely within its permissions while doing the wrong thing.
   */
  needsApproval: true,
});

export const ListFiles = Tool.make("ListFiles", {
  description:
    "List the files uploaded to the caller's organization. Returns metadata only — names, "
    + "types and sizes. Reading a file's contents is not available through this tool.",
  success: Schema.Array(FileSummary),
  ...returnsRefusals,
  dependencies: [SqlClient.SqlClient, CurrentUser],
});

/**
 * One toolkit, two consumers: the MCP server exposes it to a client the person
 * drives themselves, and the assistant hands it to a language model. Declaring
 * it once is what keeps those two from drifting into different capabilities.
 */
export const AgentToolkit = Toolkit.make(
  WhoAmI,
  ListContacts,
  SearchContacts,
  CreateContact,
  ListFiles,
);
