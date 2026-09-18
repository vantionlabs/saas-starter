import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.js";

/**
 * A factory, not a module-level singleton.
 *
 * Start calls this once per request on the server, so two requests cannot share
 * a router — and with it, one visitor's matched data. The browser calls it once.
 */
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
