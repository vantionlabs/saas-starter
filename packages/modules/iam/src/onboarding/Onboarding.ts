import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { OnboardingState } from "./OnboardingRpc.js";
import type { OnboardingStep } from "./OnboardingRpc.js";

/**
 * Reading and writing where a workspace got to.
 *
 * Plain effects rather than handlers, because the gate in `apps/web` needs the
 * read without going through a procedure and the wizard needs the writes — the
 * same split `packages/modules/admin` makes for the same reason.
 *
 * No `withOrgScope`: `organization` carries no row-level security, for the
 * reason `0011_sso.sql` gives at length — better-auth owns the table and writes
 * it outside any scoped transaction. The predicate is the organization the
 * caller is actually in, which is what keeps this honest.
 */

const stateOf = (row: { step: string | null; completedAt: Date | null; }) =>
  new OnboardingState({
    /**
     * A row with no step has not started. It is only ever `done` here when the
     * organization predates this feature, and the migration marked those
     * complete — so "no step, not complete" is genuinely the beginning.
     */
    step: (row.step ?? "organization") as OnboardingStep,
    completed: row.completedAt !== null,
  });

export const getOnboarding = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;
  const identity = yield* CurrentUser;

  const rows = yield* sql<{ step: string | null; completedAt: Date | null; }>`
    select "onboardingStep" as "step", "onboardingCompletedAt" as "completedAt"
    from "organization" where "id" = ${identity.orgId}
  `.pipe(Effect.orDie);

  /**
   * An organization that is not there is finished, not at step one. The caller
   * is inside it by definition — `AuthMiddleware` resolved it from their
   * session — so a missing row means it was deleted in the last moment, and
   * sending somebody to set up a workspace that no longer exists is the worse
   * of the two wrong answers.
   */
  return rows[0] === undefined
    ? new OnboardingState({ step: "done", completed: true })
    : stateOf(rows[0]);
});

export const setOnboardingStep = Effect.fnUntraced(function*(step: OnboardingStep) {
  const sql = yield* SqlClient.SqlClient;
  const identity = yield* CurrentUser;

  /**
   * Writing the step you have *reached*, so finishing the same step twice
   * leaves the same row. An increment would depend on where the server thought
   * you were, and two tabs would disagree.
   */
  yield* sql`
    update "organization" set "onboardingStep" = ${step} where "id" = ${identity.orgId}
  `.pipe(Effect.orDie);

  return yield* getOnboarding();
});

export const finishOnboarding = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;
  const identity = yield* CurrentUser;

  /**
   * `coalesce` so finishing twice keeps the first time. The column answers
   * "when did this workspace get set up", and a second visit to the last screen
   * should not rewrite that.
   */
  yield* sql`
    update "organization"
    set "onboardingStep" = 'done',
        "onboardingCompletedAt" = coalesce("onboardingCompletedAt", now())
    where "id" = ${identity.orgId}
  `.pipe(Effect.orDie);

  return yield* getOnboarding();
});
