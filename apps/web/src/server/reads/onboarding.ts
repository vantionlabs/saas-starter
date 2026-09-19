import { dehydrate } from "@/server/hydration.js";
import type { Dehydrated } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { onboardingSerial } from "@vantion/core/atoms/Onboarding";

/**
 * Where this workspace got to, for the gate and for the wizard.
 *
 * It returns `completed` beside the dehydrated read rather than only the
 * dehydrated value, because the gate has to *decide* on it and the dehydrated
 * form is JSON text by the time it crosses the wire — a loader that wanted the
 * boolean would have to parse and decode the thing it is about to hand
 * untouched to `HydrationBoundary`. One round trip answers both.
 */
export const getOnboarding = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ readonly completed: boolean; readonly hydrate: Dehydrated; }> => {
    const state = await serverRpc((client) => client("GetOnboarding", undefined));

    return { completed: state.completed, hydrate: dehydrate(onboardingSerial, state) };
  },
);
