import { forward } from "@/server/proxy.js";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Signed file links, when uploads go to `FILES_DIR` rather than a bucket.
 *
 * The API signs them against its `AUTH_BASE_URL`, which is this origin, so an
 * `<img>` on this page loads from here. With a bucket configured the API does
 * not serve `/api/files/*` at all and this route answers 404 from there.
 *
 * Under `/api` rather than at `/files`, which is the product's Files page: a
 * splat at `/files/$` also matches the bare `/files`, and forwarded the page
 * itself to the API.
 */
export const Route = createFileRoute("/api/files/$")({
  server: { handlers: { ANY: ({ request }) => forward(request) } },
});
