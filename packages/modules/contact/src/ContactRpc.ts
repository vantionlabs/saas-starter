import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { Forbidden } from "@vantion/module-iam/identity/Policy";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const ContactId = Schema.String.pipe(Schema.brand("ContactId")).annotate({
  identifier: "ContactId",
});
export type ContactId = typeof ContactId.Type;

/**
 * Someone an organization intends to reach out to.
 *
 * Deliberately thin: this is the worked example of a tenant-owned entity, and
 * the feature built on top decides what else a contact needs to carry.
 */
export class Contact extends Schema.Class<Contact>("Contact")({
  id: ContactId,
  email: Schema.String,
  fullName: Schema.String,
}) {}

/** Counts for the dashboard, in one round trip rather than three. */
export class Overview extends Schema.Class<Overview>("Overview")({
  contacts: Schema.Number,
  members: Schema.Number,
  customRoles: Schema.Number,
}) {}

/**
 * What a contact's fields must be, declared **once** and in the contract.
 *
 * The payload below is built from these and so is the form that submits it, so
 * a rule cannot hold on one side and not the other. The alternative is what was
 * here before: the procedure checked `isNonEmpty` with no message while the
 * screen kept its own copy of the same rule with a nicer one — two places for
 * one fact, and the server's version was the one nobody could read.
 *
 * Every check carries a `message`, because these are what a person reads.
 * effect-form's default formatter prefers them over its own generated
 * `Expected a value with a length of at least 1`, and `apps/mobile` gets the
 * same sentences for free rather than inventing its own.
 */
export const ContactFields = {
  fullName: Schema.String.check(Schema.isNonEmpty({ message: "Enter a name." })),
  email: Schema.String.check(
    Schema.isNonEmpty({ message: "Enter an email address." }),
    /**
     * Deliberately permissive, the same judgement the auth schemas make: the
     * only real proof an address works is that mail to it arrives, and a strict
     * pattern rejects valid addresses.
     */
    Schema.isIncludes("@", { message: "That does not look like an email address." }),
  ),
};

export const ContactRpcs = RpcGroup.make(
  Rpc.make("ListContacts", { success: Schema.Array(Contact), error: Forbidden }),
  Rpc.make("CreateContact", {
    // The same fields the form validates with, so the two cannot disagree.
    payload: ContactFields,
    success: Contact,
    error: Forbidden,
  }),
  Rpc.make("DeleteContact", {
    payload: { id: ContactId },
    success: Schema.Void,
    error: Forbidden,
  }),
  Rpc.make("GetOverview", { success: Overview, error: Forbidden }),
).middleware(AuthMiddleware);
