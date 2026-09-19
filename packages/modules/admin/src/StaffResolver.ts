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

/**
 * Staff, but without a second factor.
 *
 * Told apart from `NotStaff` on purpose, and it is the one distinction worth
 * making: the caller has already proved who they are, so there is nothing left
 * to leak, and "you are staff, go and enrol" is the only refusal here that a
 * person can act on. Refusing it as `NotStaff` would leave somebody staring at
 * a panel they hold the role for and cannot open.
 */
export class TwoFactorRequired
  extends Schema.TaggedError<TwoFactorRequired>()("TwoFactorRequired", {})
{}

export interface StaffResolverService {
  /** The staff member behind a session, or `NotStaff`. */
  readonly resolve: (userId: string) => Effect.Effect<Staff, NotStaff | TwoFactorRequired>;
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
            pool.query<{
              email: string;
              role: string | null;
              banned: boolean | null;
              twoFactorEnabled: boolean | null;
            }>(
              `select "email", "role", "banned", "twoFactorEnabled" from "user" where "id" = $1`,
              [userId],
            )
          ).pipe(
            /**
             * Annotated, because three branches returning three different
             * failures widen to `unknown` otherwise and the service type stops
             * saying anything.
             */
            Effect.flatMap((result): Effect.Effect<Staff, NotStaff | TwoFactorRequired> => {
              const row = result.rows[0];

              if (
                row === undefined || row.role === null || !ADMIN_ROLES.has(row.role)
                || row.banned === true
              ) {
                return Effect.fail(new NotStaff());
              }

              /**
               * A second factor is not optional here.
               *
               * `apps/admin` reads across every tenant, and its whole
               * protection is that somebody proved they are staff — which
               * without this is one password and one session cookie. The
               * product offers 2FA to customers; this *requires* it of the
               * people who can see everybody's data, and requires it on every
               * request rather than at enrolment, so turning it off closes the
               * panel immediately.
               */
              if (row.twoFactorEnabled !== true) {
                return Effect.fail(new TwoFactorRequired());
              }

              return Effect.succeed(new Staff({ userId, email: row.email }));
            }),
            /**
             * Authorisation must not fail open. Every other resolver here falls
             * back to *fewer* permissions when a lookup breaks; the only
             * equivalent for this one is refusing.
             *
             * `catchDefect`, not `catchCause`: the latter catches typed
             * failures too, so it swallowed the `TwoFactorRequired` raised
             * above and reported it as `NotStaff` — turning the one actionable
             * refusal on this surface into the one that says nothing. A test
             * caught it, which is the argument for having written that test.
             *
             * `Effect.promise` turns a rejected query into a defect, so a
             * defect is exactly the case this is for.
             */
            Effect.catchDefect(() => Effect.fail(new NotStaff())),
          ),
      };
    }),
  );
}
