import "@testing-library/jest-dom/vitest";
import { addEqualityTesters } from "@effect/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

addEqualityTesters();

/**
 * Two things happy-dom does not implement that cmdk uses to keep its list sized and
 * its selection visible. No-ops are enough — nothing here asserts on measured
 * layout or scroll position, and the alternative is not being able to test the
 * command palette at all.
 */
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Guarded because a server-side test opts into `@vitest-environment node`,
// where there is no DOM to patch — and no DOM `fetch` in place of the real one.
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

// Component tests run concurrently, so each must leave the DOM as it found it.
afterEach(cleanup);
