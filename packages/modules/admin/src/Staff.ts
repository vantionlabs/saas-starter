import { Context, Schema } from "effect";

/**
 * Somebody who works here, which is not somebody who works for a customer.
 *
 * Deliberately **not** an `Identity`. That type carries an `orgId` and a set of
 * permissions resolved within it, because every other caller in this system is
 * acting inside exactly one organization — that is what makes `withOrgScope`
 * safe and what the whole schema's row-level security keys on.
 *
 * Staff are the exception the rest of the design exists to prevent, so they get
 * their own type rather than an `Identity` with a flag on it. A flag would mean
 * every handler that takes an `Identity` could be reached by a caller for whom
 * the tenant field is meaningless, and the compiler would have nothing to say
 * about it.
 */
export class Staff extends Schema.Class<Staff>("Staff")({
  userId: Schema.String,
  email: Schema.String,
}) {}

/** Provided by the admin application's own middleware, and by nothing else. */
export class CurrentStaff extends Context.Service<CurrentStaff, Staff>()("CurrentStaff") {}
