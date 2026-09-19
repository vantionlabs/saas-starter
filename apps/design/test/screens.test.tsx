import { personas } from "@/fixtures/personas.js";
import { routeTree } from "@/router.js";
import { describe, expect, it } from "@effect/vitest";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Every screen on the canvas, rendered through the real router.
 *
 * This app has no backend, so nothing here can fail on data — which is exactly
 * how it breaks quietly: a component moves, an import goes stale, and the only
 * way anybody finds out is by opening the page. A designer opening a blank
 * screen is worse than a failing test.
 *
 * Through the router rather than by rendering the component, because the
 * persona travels in the query string and `usePersona` reads it from there:
 * calling the screen directly would test a component the app never renders
 * that way.
 */
const at = async (path: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(<RouterProvider router={router as never} />);

  // The router resolves its match asynchronously, so the assertion waits for
  // the screen rather than for a frame.
  await waitFor(() => expect(document.body.textContent).not.toBe(""));
};

/**
 * The surfaces with no personas: a landing page has no empty state and a brand
 * kit has no tenant. Everything else on the canvas is a product screen.
 */
const withoutPersonas = ["/marketing", "/brand"];

/**
 * Read off the route tree rather than listed here.
 *
 * A hand-written list is a list that silently stops covering a screen the day
 * one is added — which is the failure this file exists to catch, arriving
 * through the file itself.
 */
const screens = (routeTree.children ?? [])
  /**
   * `route.path` is `"assistant"`, not `"/assistant"` — the root's own child is
   * the only one that keeps its slash. Filtering without normalising matches
   * nothing, which is how the two surfaces below were briefly run through every
   * persona and nobody noticed: they render the same whichever one is asked
   * for.
   */
  .map((route) => (route.path.startsWith("/") ? route.path : `/${route.path}`))
  .filter((path) => !withoutPersonas.includes(path));

describe("the product screens", () => {
  /**
   * `children` is optional on the route type, so the fallback above could make
   * this whole block vacuous — a file of zero tests reports the same green as a
   * file of thirty.
   */
  it("finds them on the route tree", () => {
    expect(screens.length).toBeGreaterThan(withoutPersonas.length);
    expect(screens).toContain("/sso");
  });

  for (const path of screens) {
    for (const persona of personas) {
      it(`renders ${path} as ${persona.id}`, async () => {
        await at(`${path}?persona=${persona.id}`);

        expect(document.body.textContent).not.toBe("");
      });
    }
  }
});

/**
 * The other two surfaces are on the same canvas, which is the point: one app a
 * designer works in, and one source `/figma-screen` reads.
 */
describe("the marketing and brand surfaces", () => {
  it("renders the marketing sections, priced from the product's own limits", async () => {
    await at("/marketing");

    expect(screen.getByText(/boring parts of your B2B product/)).toBeInTheDocument();
    expect(screen.getByText("3 seats")).toBeInTheDocument();
  });

  it("renders the brand kit from the tokens", async () => {
    await at("/brand");

    expect(screen.getAllByText("background").length).toBeGreaterThan(0);
    expect(screen.getByText("Voice")).toBeInTheDocument();
  });
});
