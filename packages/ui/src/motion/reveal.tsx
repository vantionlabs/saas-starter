import { AnimatePresence, LazyMotion, m } from "motion/react";
import type * as React from "react";
import { useHydrated } from "../lib/use-hydrated.js";
import { features, useTransition } from "./motion.js";
import type { Speed } from "./motion.js";

/**
 * `LazyMotion` around each of these rather than a provider at the root.
 *
 * A provider would mean every application rendering one of these also has to
 * remember to wrap itself, and forgetting is a runtime error on a page nobody
 * was changing. Nesting `LazyMotion` is cheap — the features are one shared
 * promise — so the component carries its own requirement.
 *
 * `strict` makes `motion.div` throw, which is the point: the shell is `m`, and
 * the 124 kB full component must not creep back in by habit.
 */
const Animated = (props: { readonly children: React.ReactNode; }) => (
  <LazyMotion features={features} strict>
    {props.children}
  </LazyMotion>
);

/**
 * Something that has just appeared because a person did something.
 *
 * Deliberately **not** for content that came down with the page. The rule this
 * enforces is the one in `motion.tsx`: an entrance animation starts at
 * `opacity: 0`, and applying that to server-rendered markup ships the page with
 * its content invisible until JavaScript runs. `useHydrated` makes that safe
 * rather than a thing to remember — before React attaches this renders its
 * children plainly, so the server's HTML is complete and readable, and the
 * animation only ever runs on something that arrived afterwards.
 *
 * The practical effect: wrap a validation message, a newly revealed panel, a
 * row somebody just created. Do not wrap a table.
 */
export const Reveal = (props: {
  readonly children: React.ReactNode;
  readonly speed?: Speed | undefined;
  readonly className?: string | undefined;
}) => {
  const transition = useTransition({ speed: props.speed });
  const hydrated = useHydrated();

  if (!hydrated) return <div className={props.className}>{props.children}</div>;

  return (
    <Animated>
      <m.div
        className={props.className}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        {props.children}
      </m.div>
    </Animated>
  );
};

/**
 * Something that comes and goes — a message, an inline error, a banner.
 *
 * `AnimatePresence` is why this is separate from `Reveal`: an element being
 * removed cannot animate itself out, because by the time React has removed it
 * there is nothing left to animate. Presence keeps it mounted for exactly as
 * long as the exit takes.
 *
 * `show` rather than conditional children, for the same reason — this has to
 * see the transition from present to absent, and `{cond && <x/>}` never gives
 * it one.
 */
export const RevealWhen = (props: {
  readonly show: boolean;
  readonly children: React.ReactNode;
  readonly speed?: Speed | undefined;
  readonly className?: string | undefined;
}) => {
  const transition = useTransition({ speed: props.speed ?? "fast" });

  return (
    <Animated>
      <AnimatePresence initial={false}>
        {props.show && (
          <m.div
            className={props.className}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition}
            style={{ overflow: "hidden" }}
          >
            {props.children}
          </m.div>
        )}
      </AnimatePresence>
    </Animated>
  );
};
