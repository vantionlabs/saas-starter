import { OnboardingState } from "@vantion/module-iam/onboarding/OnboardingRpc";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { AppRpc } from "../AppRpc.js";
import { Keys } from "../Keys.js";

/**
 * Where setting up this workspace got to.
 *
 * Rendered on the server twice over, which is why the pair is here beside the
 * atom: the gate in `_protected` reads it to decide a redirect, and the wizard
 * itself hydrates it so the first screen is the step somebody left off at
 * rather than a spinner in front of one.
 *
 * It subscribes to `Keys.organization` as well as its own key, because the
 * answer is per workspace — switching organization while a second one is still
 * being set up must not leave the finished one's state on screen.
 */
export const onboardingSerial = {
  key: "onboarding",
  schema: AsyncResult.Schema({ success: OnboardingState }),
};

export const onboardingAtom = Atom.withReactivity([Keys.organization, Keys.onboarding])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("GetOnboarding", undefined);
    }),
  ),
).pipe(Atom.serializable(onboardingSerial));

/**
 * Finishing invalidates `onboarding` rather than writing the returned state
 * into the atom by hand, so there is one place that decides whether somebody
 * is still onboarding — the server — instead of two that disagree after a
 * failed write.
 *
 * There is no `setOnboardingStep` atom beside it, and the absence is the
 * design: advancing a step always happens *with* the write that step was for,
 * inside that submit, so the name somebody typed and the progress they made
 * land together. A separate atom would be the way to rename a workspace and
 * still be asked to name it tomorrow.
 */
export const finishOnboardingAtom = AppRpc.runtime.fn<void>()(
  () =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("FinishOnboarding", undefined);
    }),
  { reactivityKeys: [Keys.onboarding] },
);
