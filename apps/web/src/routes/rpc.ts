import { forward } from "@/server/proxy.js";
import { createFileRoute } from "@tanstack/react-router";

/**
 * The RPC endpoint the browser's client posts to, forwarded to the API.
 *
 * HTTP only: the browser's client uses `layerProtocolHttp`, and `/rpc/ws` —
 * which a proxied fetch cannot carry — stays on the API for clients that open
 * a socket.
 */
export const Route = createFileRoute("/rpc")({
  server: { handlers: { ANY: ({ request }) => forward(request) } },
});
