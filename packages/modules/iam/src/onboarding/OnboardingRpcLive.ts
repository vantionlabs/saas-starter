import { Layer } from "effect";
import { finishOnboarding, getOnboarding, setOnboardingStep } from "./Onboarding.js";
import { OnboardingRpcs } from "./OnboardingRpc.js";

/**
 * No policy on any of these.
 *
 * Deliberate, and the one thing to think about here: onboarding is not an
 * administrative action. Anybody who is *in* an organization that has not been
 * set up should be able to finish setting it up — gating it on
 * `organization:update` would mean the second person to arrive at a
 * half-configured workspace is shown a wizard they cannot complete and a
 * product they cannot reach. The steps themselves call procedures that *are*
 * gated, so what somebody may actually change is still decided there.
 */
export const OnboardingRpcLive = Layer.mergeAll(
  OnboardingRpcs.toLayerHandler("GetOnboarding", () => getOnboarding()),
  OnboardingRpcs.toLayerHandler("SetOnboardingStep", (payload) => setOnboardingStep(payload.step)),
  OnboardingRpcs.toLayerHandler("FinishOnboarding", () => finishOnboarding()),
);
