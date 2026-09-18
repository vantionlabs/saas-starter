import * as Job from "@vantion/module-jobs/Job";
import { Schema } from "effect";

/**
 * Emitted when a contact is created, in the same transaction as the insert.
 *
 * The payload is the contact as a subscriber sees it, not a row id to look up.
 * A receiver that has to call back for the data is a receiver that sees a
 * different answer than the one the event described, because by then it may have
 * changed — or been deleted.
 */
export const ContactCreated = Job.make("contact.created", {
  payload: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    fullName: Schema.String,
  }),
});
