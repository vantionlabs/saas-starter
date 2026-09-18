import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { Effect } from "effect";
import { CurrentUser } from "./Identity.js";

/**
 * Runs `self` in a transaction whose `app.current_org` is the caller's org, so
 * the row-level security policies apply.
 *
 * The org is read from `CurrentUser` rather than taken as an argument — a
 * caller can therefore never name a tenant that is not their own.
 *
 * It lives here rather than beside `withOrgScopeFor` because reading the caller
 * is an identity concern: `@vantion/database` would otherwise have to depend on
 * this module, which depends on it.
 */
export const withOrgScope = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const identity = yield* CurrentUser;

    return yield* withOrgScopeFor(identity.orgId, self);
  });
