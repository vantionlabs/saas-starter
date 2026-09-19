import { CurrentUser, Identity, OrgId, UserId } from "@/identity/Identity.js";
import { permissionsFor } from "@/identity/Permission.js";
import { finishOnboarding, getOnboarding, setOnboardingStep } from "@/onboarding/Onboarding.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

const ORG = "org_onboarding";

const caller = Layer.succeed(CurrentUser)(
  new Identity({
    userId: UserId.make("user_onboarding"),
    orgId: OrgId.make(ORG),
    email: "new@example.com",
    emailVerified: true,
    role: "owner",
    permissions: Array.from(permissionsFor("owner")),
  }),
);

const live = caller.pipe(Layer.provideMerge(PgLive), Layer.provideMerge(PgPoolTest));

/** A freshly created organization: no step, not finished. */
const fresh = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${ORG}, ${ORG}, ${ORG}, now()) on conflict ("id") do nothing`;
  yield* sql`update "organization"
             set "onboardingStep" = null, "onboardingCompletedAt" = null
             where "id" = ${ORG}`;
});

describe.skipIf(testDbUrl() === undefined)("onboarding", () => {
  it.effect("starts a new workspace at the first step", () =>
    Effect.gen(function*() {
      yield* fresh();

      const state = yield* getOnboarding();

      expect(state.step).toBe("organization");
      expect(state.completed).toBe(false);
    }).pipe(Effect.provide(live)));

  /**
   * The property that makes this resumable: the step is written, so closing
   * the tab on step two and coming back tomorrow returns to step two rather
   * than to the beginning.
   */
  it.effect("remembers the step it reached", () =>
    Effect.gen(function*() {
      yield* fresh();

      yield* setOnboardingStep("invite");

      expect((yield* getOnboarding()).step).toBe("invite");
      expect((yield* getOnboarding()).completed).toBe(false);
    }).pipe(Effect.provide(live)));

  /**
   * Naming the step reached rather than incrementing is what makes two tabs
   * safe: doing the same step twice leaves the same row.
   */
  it.effect("is idempotent about a step", () =>
    Effect.gen(function*() {
      yield* fresh();

      yield* setOnboardingStep("invite");
      const twice = yield* setOnboardingStep("invite");

      expect(twice.step).toBe("invite");
    }).pipe(Effect.provide(live)));

  it.effect("finishes, and says so", () =>
    Effect.gen(function*() {
      yield* fresh();

      const done = yield* finishOnboarding();

      expect(done.step).toBe("done");
      expect(done.completed).toBe(true);
    }).pipe(Effect.provide(live)));

  /**
   * The column answers "when was this workspace set up", so a second visit to
   * the last screen must not rewrite it.
   */
  it.effect("keeps the first completion time", () =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      yield* fresh();

      yield* finishOnboarding();
      const [first] = yield* sql<{ at: Date; }>`
        select "onboardingCompletedAt" as "at" from "organization" where "id" = ${ORG}
      `;

      yield* finishOnboarding();
      const [second] = yield* sql<{ at: Date; }>`
        select "onboardingCompletedAt" as "at" from "organization" where "id" = ${ORG}
      `;

      expect(second?.at.toISOString()).toBe(first?.at.toISOString());
    }).pipe(Effect.provide(live)));

  /**
   * Somebody whose organization vanished mid-session is finished, not sent to
   * set up a workspace that is not there. The worse of the two wrong answers.
   */
  it.effect("treats a missing organization as finished", () =>
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`delete from "organization" where "id" = ${ORG}`;

      const state = yield* getOnboarding();

      expect(state.completed).toBe(true);
    }).pipe(Effect.provide(live)));
});
