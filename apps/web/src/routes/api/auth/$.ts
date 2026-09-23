import { forward } from "@/server/proxy.js";
import { createFileRoute } from "@tanstack/react-router";

/**
 * better-auth, answered from this origin so its cookie is first-party here.
 * `server/proxy.ts` says why the browser never talks to the API directly.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { ANY: ({ request }) => forward(request) } },
});
