import * as React from "react";

/*
 * Adapted from Beautiful UI's Streaming Text (MIT, © 2026 Shane Levine,
 * https://www.beautifului.dev). The original animates a fixed script on a
 * timer; this one is driven by text arriving over the wire, which is the
 * difference between a demonstration of streaming and streaming.
 *
 * What was kept is the thing worth keeping: each word resolves out of blur as
 * it lands, so a slow answer reads as thinking rather than as lag. The inline
 * citations, source list, feedback buttons and follow-up prompts were dropped —
 * this assistant has no retrieval corpus to cite, and a row of thumbs that
 * records nothing is furniture.
 */

/** Words already written, plus the one being written. */
const words = (text: string) => text.split(/(\s+)/).filter((part) => part !== "");

export const Answer = (props: {
  readonly text: string;
  /** While true the caret shows: the answer is still arriving. */
  readonly streaming?: boolean;
}) => {
  const parts = React.useMemo(() => words(props.text), [props.text]);

  return (
    <div className="text-[14px] leading-[1.65] text-ink">
      {parts.map((part, index) => (
        <span
          // Position is the identity here, deliberately: a word's index does
          // not change once it has arrived, so React keeps the element and the
          // animation does not replay on every chunk.
          key={`${index}-${part}`}
          style={{
            animation: "word-in 260ms cubic-bezier(0.23,1,0.32,1) both",
          }}
        >
          {part}
        </span>
      ))}
      {props.streaming === true && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-ink"
          style={{ animation: "caret-blink 1.1s steps(1) infinite" }}
        />
      )}
    </div>
  );
};

/**
 * What the assistant is doing while nothing has arrived yet.
 *
 * Adapted from Beautiful UI's Loading State: a shimmer over a word rather than
 * a spinner, because a spinner says "working" and this says what it is working
 * on.
 */
export const Working = (props: { readonly label: string; }) => (
  <div
    className="inline-flex items-center gap-2 text-[13px] text-ink-2"
    style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
  >
    <span
      className="bg-[linear-gradient(90deg,var(--ink-3)_0%,var(--ink)_50%,var(--ink-3)_100%)] bg-[length:200%_auto] bg-clip-text text-transparent"
      style={{ animation: "shimmer-text 1.8s linear infinite" }}
    >
      {props.label}
    </span>
  </div>
);
