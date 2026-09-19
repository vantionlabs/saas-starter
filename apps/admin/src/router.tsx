import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.js";

/** A factory, not a singleton: Start calls it once per request on the server. */
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
