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

const screens = ["/", "/contacts", "/members", "/api-keys", "/billing", "/assistant", "/sign-in"];

describe("the product screens", () => {
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
