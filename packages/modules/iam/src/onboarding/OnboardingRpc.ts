import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { AuthMiddleware } from "../identity/AuthMiddleware.js";
import { Forbidden } from "../identity/Policy.js";

/**
 * Setting up a workspace, one step at a time and resumable.
 *
 * The steps are a **closed union**, not free text: the gate that decides
 * whether somebody is still onboarding reads this value, and a typo in it
 * would send a tenant to a screen that does not exist. It also means adding a
 * step is a compile error everywhere the wizard switches on one, which is
 * where you want to be reminded.
 */
export const OnboardingStep = Schema.Literals(["organization", "invite", "done"]);
export type OnboardingStep = typeof OnboardingStep.Type;

/**
 * Where this organization got to, and whether it is finished.
 *
 * `completed` is separate from `step` rather than being `step === "done"`,
 * because they answer different questions and can legitimately disagree: an
 * organization created before this feature existed is finished without ever
 * having had a step, and somebody who skips the wizard is finished on step two.
 */
export class OnboardingState extends Schema.Class<OnboardingState>("OnboardingState")({
  step: OnboardingStep,
  completed: Schema.Boolean,
}) {}

export const OnboardingRpcs = RpcGroup.make(
  Rpc.make("GetOnboarding", { success: OnboardingState, error: Forbidden }),
  /**
   * Advancing is a **write of the whole state**, not an increment.
   *
   * A `next()` that moved one step forward would depend on where the server
   * thought you were, and two tabs would disagree. Naming the step you have
   * reached is idempotent: finishing the same step twice leaves the same row.
   */
  Rpc.make("SetOnboardingStep", {
    payload: { step: OnboardingStep },
    success: OnboardingState,
    error: Forbidden,
  }),
  /**
   * Skippable, and deliberately.
   *
   * A wizard somebody cannot leave is one they abandon at the browser tab
   * instead. Everything it asks for is reachable from settings afterwards, so
   * skipping costs them nothing but a slower start.
   */
  Rpc.make("FinishOnboarding", { success: OnboardingState, error: Forbidden }),
  /**
   * Every procedure here is behind the session, which is what provides
   * `CurrentUser` — and therefore the organization these read and write. The
   * organization is never a payload: it is whichever one the caller is in.
   */
).middleware(AuthMiddleware);
