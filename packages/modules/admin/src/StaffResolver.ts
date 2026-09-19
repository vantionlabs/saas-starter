import { PgPool } from "@vantion/database/PgPool";
import { Context, Effect, Layer, Schema } from "effect";
import { Staff } from "./Staff.js";

/**
 * Somebody signed in who is not staff, or nobody signed in at all.
 *
 * One error for both, and deliberately: an admin surface that distinguished
 * "you are not signed in" from "you are signed in but not staff" would confirm
 * to an anonymous caller that the second state exists and that a given account
 * is or is not in it.
 */
export class NotStaff extends Schema.TaggedError<NotStaff>()("NotStaff", {}) {}

export interface StaffResolverService {
  /** The staff member behind a session, or `NotStaff`. */
  readonly resolve: (userId: string) => Effect.Effect<Staff, NotStaff>;
}

/**
 * `user.role`, which better-auth's `admin` plugin owns.
 *
 * Read here rather than trusted from a session payload: a role is the sort of
 * thing that changes while somebody is signed in, and revoking it should take
 * effect on their next request rather than when their session happens to
 * expire.
 *
 * `banned` is honoured for the same reason. better-auth checks it on its own
 * endpoints; this is the check for ours, and leaving it out would mean a banned
 * account kept the one kind of access that matters most.
 */
const ADMIN_ROLES: ReadonlySet<string> = new Set(["admin"]);

export class StaffResolver extends Context.Service<StaffResolver, StaffResolverService>()(
  "StaffResolver",
) {
  static layer: Layer.Layer<StaffResolver, never, PgPool> = Layer.effect(StaffResolver)(
    Effect.gen(function*() {
      const pool = yield* PgPool;

      return {
        resolve: (userId: string) =>
          Effect.promise(() =>
            pool.query<{ email: string; role: string | null; banned: boolean | null; }>(
              `select "email", "role", "banned" from "user" where "id" = $1`,
              [userId],
            )
          ).pipe(
            Effect.flatMap((result) => {
              const row = result.rows[0];

              if (
                row === undefined || row.role === null || !ADMIN_ROLES.has(row.role)
                || row.banned === true
              ) {
                return Effect.fail(new NotStaff());
              }

              return Effect.succeed(new Staff({ userId, email: row.email }));
            }),
            /**
             * Authorisation must not fail open. Every other resolver here falls
             * back to *fewer* permissions when a lookup breaks; the only
             * equivalent for this one is refusing.
             */
            Effect.catchCause(() => Effect.fail(new NotStaff())),
          ),
      };
    }),
  );
}
