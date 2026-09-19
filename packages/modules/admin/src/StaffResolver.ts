import { PgPool } from "@vantion/database/PgPool";
import { Config, Context, Effect, Layer, Schema } from "effect";
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

/**
 * Whether a second factor is a condition of reaching this surface. **Off.**
 *
 * The role is the authorisation gate and always was: 2FA does not decide who
 * may read across tenants, it decides how strongly somebody proved they are
 * the person who may. Those are different questions and only the first belongs
 * in a starter's defaults.
 *
 * What turning it on buys is narrow and worth stating, because this surface
 * holds `ADMIN_DATABASE_URL`: a stolen staff session is cross-tenant read
 * access to every customer, and a role check cannot tell a stolen session from
 * a real one. A deployment with real customer data should set this.
 *
 * What it costs is why it is not the default: the first staff member has to
 * enrol at `/settings/security` before the panel opens at all, which is
 * friction a template should not impose on somebody trying it out.
 */
const REQUIRE_TWO_FACTOR = Config.boolean("ADMIN_REQUIRE_2FA").pipe(
  Config.withDefault(false),
);

export class StaffResolver extends Context.Service<StaffResolver, StaffResolverService>()(
  "StaffResolver",
) {
  static layer: Layer.Layer<StaffResolver, never, PgPool> = Layer.effect(StaffResolver)(
    Effect.gen(function*() {
      const pool = yield* PgPool;
      const requireTwoFactor = yield* REQUIRE_TWO_FACTOR.pipe(Effect.orDie);

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
               * Checked per request when the deployment asks for it, so
               * turning 2FA off closes the panel immediately rather than at the
               * end of a session.
               */
              if (requireTwoFactor && row.twoFactorEnabled !== true) {
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
