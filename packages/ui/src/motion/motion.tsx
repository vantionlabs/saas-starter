import { durations, easings } from "@vantion/tokens/tokens";
import { cubicBezier, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";

/**
 * Motion, from the same tokens the stylesheet is generated from.
 *
 * `motion/react` wants numbers and an easing function; CSS wants a string. Both
 * come from `@vantion/tokens` rather than being written twice, so a curve
 * changed in one place changes everywhere — including `apps/brand`, whose whole
 * argument is that it is generated rather than maintained.
 *
 * **Two rules hold everything here together.**
 *
 * *Nothing that is server-rendered may start invisible.* An entrance animation
 * is `initial={{ opacity: 0 }}`, and on a server-rendered page that means the
 * markup ships with the content hidden until JavaScript runs — which undoes the
 * reason the read was moved to the server at all, and leaves anything without
 * JavaScript looking at an empty page. So these animate **chrome**: things that
 * appear in response to a person, after hydration, and did not exist in the
 * document a moment ago. A list that came down with the page does not fade in.
 *
 * *Everything respects `prefers-reduced-motion`.* Not as a nicety: for some
 * people motion is nausea, and a setting the operating system already carries
 * should not need asking for twice. `useReducedMotion` collapses a transition
 * to zero duration rather than removing the animation, so the end state is
 * identical and only the travel is gone.
 */

const curve = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
} as const;

/** Seconds, because `motion/react` counts in them and the tokens are in milliseconds. */
const seconds = (ms: number) => ms / 1000;

export type Speed = keyof typeof durations;

/**
 * A transition built from the tokens, already reduced when it should be.
 *
 * Returns a zero-duration transition under `prefers-reduced-motion`, which is
 * what makes every component below honour the setting without each one asking.
 */
export const useTransition = (
  options: {
    readonly speed?: Speed | undefined;
    readonly ease?: keyof typeof curve | undefined;
  } = {},
): Transition => {
  const reduced = useReducedMotion();

  return {
    duration: reduced === true ? 0 : seconds(durations[options.speed ?? "base"]),
    ease: curve[options.ease ?? "out"],
  };
};

/**
 * The CSS forms, for the places that are not React components.
 *
 * Exported so a stylesheet or an inline style uses the same curve as a
 * `motion/react` animation instead of an approximation of it.
 */
export const css = {
  easing: easings,
  duration: durations,
} as const;

/**
 * The feature set, loaded only when something actually animates.
 *
 * Importing `motion/react`'s full component adds **124 kB** of client
 * JavaScript, measured — the same order as the Stripe SDK that once leaked into
 * this bundle, and for a product whose reads now arrive with the document that
 * is a poor trade for some fades. `LazyMotion` splits it: the `m` component is
 * a shell, and `domAnimation` arrives in its own chunk the first time a page
 * needs it.
 *
 * `strict` is what keeps it that way. It makes `motion.div` throw at runtime,
 * so the expensive import cannot creep back in by habit — the convention is
 * enforced by the library rather than by review.
 */
export const features = () => import("motion/react").then((mod) => mod.domAnimation);
