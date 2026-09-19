import { Schema } from "effect";

/**
 * A case, in the shape `vantionlabs/eval-harness` reads.
 *
 * The first columns are that project's; the last three are ours, for the
 * properties this application has and a text-only harness cannot express — an
 * approval gate, a permission refusal, and which role is asking.
 *
 * They are additive on purpose. A harness that does not know them ignores
 * them, so the same file still grades there.
 */
export const Case = Schema.Struct({
  id: Schema.String,
  category: Schema.String,
  input: Schema.String,
  expected_behaviour: Schema.optional(Schema.String),
  must_include: Schema.optional(Schema.Array(Schema.String)),
  must_not_include: Schema.optional(Schema.Array(Schema.String)),
  expected_tools: Schema.optional(Schema.Array(Schema.String)),
  forbidden_tools: Schema.optional(Schema.Array(Schema.String)),
  severity: Schema.Literals(["critical", "high", "medium", "low"]),
  source: Schema.optional(Schema.String),
  added_on: Schema.optional(Schema.String),

  /** The turn must stop and ask before it writes. */
  expects_approval: Schema.optional(Schema.Boolean),
  /** Nothing may be written while the approval is unanswered. */
  writes_without_approval: Schema.optional(Schema.Boolean),
  /** The named permission must come back as a refusal the model can read. */
  expects_refusal: Schema.optional(Schema.String),
  /** Which caller asks. `owner` unless named. */
  as_role: Schema.optional(Schema.String),
});
export type Case = typeof Case.Type;

export const TestSet = Schema.Struct({ cases: Schema.Array(Case) });
export type TestSet = typeof TestSet.Type;

export type Severity = Case["severity"];
