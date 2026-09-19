import { render, screen } from "@testing-library/react";
import { durations, easings } from "@vantion/tokens/tokens";
import { Reveal, RevealWhen } from "@vantion/ui/motion/reveal";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("motion", () => {
  /**
   * The rule the whole module exists to enforce.
   *
   * An entrance animation starts at `opacity: 0`. On a server-rendered page
   * that means shipping the markup with its content invisible until JavaScript
   * runs — which undoes the reason the read was moved to the server, and leaves
   * anything without JavaScript looking at nothing. `Reveal` renders its
   * children plainly until React has attached, so the server's HTML is always
   * complete.
   */
  it("never hides its children in server-rendered markup", () => {
    const html = renderToStaticMarkup(<Reveal>Nine hundred contacts</Reveal>);

    expect(html).toContain("Nine hundred contacts");
    expect(html).not.toContain("opacity:0");
    expect(html).not.toContain("opacity: 0");
  });

  it("still renders its children once attached", () => {
    render(<Reveal>Arrived just now</Reveal>);

    expect(screen.getByText("Arrived just now")).toBeInTheDocument();
  });

  /** Hidden means absent, not transparent — nothing to read for a screen reader. */
  it("renders nothing when it has nothing to show", () => {
    render(<RevealWhen show={false}>Something went wrong</RevealWhen>);

    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders its children when shown", () => {
    render(<RevealWhen show>Something went wrong</RevealWhen>);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  /**
   * The tokens are the source, so a curve changed in one place changes the
   * stylesheet, the brand kit and every `motion/react` animation together. This
   * asserts the shape rather than the values — the numbers are a design
   * decision and meant to be changed; having only three of them is not.
   */
  it("keeps the scale small enough that nobody has to guess", () => {
    expect(Object.keys(durations)).toEqual(["fast", "base", "slow"]);
    expect(Object.keys(easings)).toEqual(["out", "inOut", "linear"]);
  });
});
