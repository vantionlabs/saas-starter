import { runtime } from "@/server/runtime.js";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { NotStaff, StaffResolver, TwoFactorRequired } from "@vantion/module-admin/StaffResolver";
import { createAuthClient } from "better-auth/client";
import { Effect } from "effect";

/**
 * Who is asking, and whether they may be here at all.
 *
 * Only this: the procedures live in `server/queries/`, one file per concern,
 * the way `packages/modules/admin/src/` is laid out. A single file holding the
 * authentication *and* every read is the one that grows a procedure somebody
 * forgot to put `requireStaff` in front of.
 */

/**
 * Where the session comes from: the customer-facing API, which owns the only
 * better-auth instance.
 *
 * A second instance here would need the same secrets, its own pool, and would
 * be a second door onto the same `user` table without `AuthHttp`'s rate limiter
 * in front of it. `apps/web` makes the same call for the same reason.
 *
 * Staff sign in through the ordinary sign-in page and then come here. There is
 * no separate credential, which is the honest trade: it means this surface is
 * only as strong as an individual's account, and `docs/admin.md` says so rather
 * than implying otherwise.
 */
const auth = createAuthClient({
  baseURL: process.env["AUTH_BASE_URL"] ?? "http://localhost:3000",
});

/**
 * Resolved per request, from the cookie, and never cached.
 *
 * `user.role` is read out of the database each time rather than taken from the
 * session payload, so revoking somebody's staff role takes effect on their next
 * request instead of whenever their session happens to expire.
 */
/**
 * Wrapped in `createServerOnlyFn`, which is not decoration.
 *
 * This module imports `runtime`, and `runtime` reaches `pg`. `whoami` below is
 * a `createServerFn` whose handler is stripped from the client bundle, but
 * `currentStaff` was a plain exported-through function the bundler could not
 * prove never runs in a browser — so the whole module, and `pg` with it, was
 * pulled toward the client and TanStack Start's import protection refused the
 * build outright. It is right to: a Postgres driver in a browser bundle is a
 * connection string looking for somewhere to leak.
 *
 * Marking it says the thing that was previously only true by convention, and
 * says it to the bundler rather than to a reader.
 */
const currentStaff = createServerOnlyFn(async () => {
  const cookie = getRequestHeader("cookie");
  if (cookie === undefined || cookie === "") return null;

  const session = await auth.getSession({ fetchOptions: { headers: { cookie } } });
  const userId = session.data?.user.id;
  if (userId === undefined) return null;

  return runtime.runPromise(
    Effect.gen(function*() {
      const resolver = yield* StaffResolver;

      return yield* resolver.resolve(userId);
    }).pipe(
      Effect.catchTag("NotStaff", () => Effect.succeed(null)),
      /**
       * Kept distinct all the way to the screen. Everything else here refuses
       * identically on purpose, but this caller has already proved who they
       * are — there is nothing left to leak, and "enrol a second factor" is the
       * only refusal on this surface somebody can do something about.
       */
      Effect.catchTag("TwoFactorRequired", () => Effect.succeed("needs-2fa" as const)),
    ),
  );
});

/** Whether to show the panel at all. Nothing else is exposed about the caller. */
export const whoami = createServerFn({ method: "GET" }).handler(async () => {
  const staff = await currentStaff();

  if (staff === null) return { staff: false as const };
  if (staff === "needs-2fa") return { staff: false as const, needsTwoFactor: true as const };

  return { staff: true as const, email: staff.email };
});

/**
 * `NotStaff` rather than a redirect or a 403 with a message.
 *
 * Everything below refuses identically whether the caller is signed out, signed
 * in as a customer, or banned — three states an anonymous caller should not be
 * able to tell apart by asking.
 */
export const requireStaff = async () => {
  const staff = await currentStaff();
  if (staff === "needs-2fa") throw new TwoFactorRequired();
  /**
   * The same `NotStaff` the module raises, thrown rather than returned because
   * that is how a server function reports a failure. One type for one
   * condition, so a caller matching on `_tag` sees the same thing whichever
   * transport it came through.
   */
  if (staff === null) throw new NotStaff();

  return staff;
};
