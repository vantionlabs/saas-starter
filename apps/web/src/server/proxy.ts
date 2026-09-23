/**
 * The API, served from this origin.
 *
 * The browser talks to one host. Authentication, RPC and signed file links are
 * forwarded from here to `apps/server` over the private network, so the session
 * cookie is an ordinary first-party cookie on whatever host served the page —
 * a generated `*.up.railway.app`, a Railway PR environment, `localhost`, a
 * custom domain — with no cookie domain to configure, no cross-origin request
 * and no API address compiled into the bundle.
 *
 * The alternative was two origins sharing a cookie across a parent domain, which
 * needs a domain of your own and a setting that fails silently when it is wrong:
 * sign-in succeeds, the cookie is dropped, and the page bounces back to sign-in.
 * On a public suffix such as `up.railway.app` it cannot work at all.
 *
 * The public API (`/api/v1`) is not proxied. It authenticates by key rather
 * than cookie, so it has no reason to share this origin, and a customer's
 * integration should not depend on the web app being up.
 */

/**
 * Where the API is, from this process: its private address in a deployment,
 * `localhost:3000` in a fresh clone. Read at run time, because a private
 * hostname is a fact about a deployment and not about the image.
 */
export const apiOrigin = (): string =>
  (process.env["API_URL"] ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Headers that describe one connection rather than the request, and so must
 * not be copied onto another. `host` would name this server to the API.
 */
const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "host",
  "content-length",
]);

/**
 * Forwards a request to the same path on the API and returns its answer.
 *
 * Three things are deliberate:
 *
 * - `X-Forwarded-For` is passed through **unchanged**. Railway's edge has
 *   already appended the caller's real address as the rightmost entry, and the
 *   API, trusting one proxy, reads exactly that one. Appending this server's
 *   view would make the rightmost entry Railway's edge, and every caller would
 *   share one rate-limit bucket — on the OTP path the limit is the security
 *   boundary, so that is a control switched off rather than a detail.
 * - Redirects are returned, not followed. An OAuth callback's `302` belongs to
 *   the browser, and following it here would set its cookies on nothing.
 * - `content-encoding` is dropped from the answer. `fetch` has already
 *   decompressed the body, and a header still claiming gzip makes the browser
 *   decode it a second time.
 */
export const forward = async (request: Request): Promise<Response> => {
  const incoming = new URL(request.url);
  const target = `${apiOrigin()}${incoming.pathname}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!hopByHop.has(name.toLowerCase())) headers.append(name, value);
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const answer = await fetch(target, {
    method: request.method,
    headers,
    redirect: "manual",
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
  });

  const returned = new Headers(answer.headers);
  returned.delete("content-encoding");
  returned.delete("content-length");
  returned.delete("transfer-encoding");

  return new Response(answer.body, {
    status: answer.status,
    statusText: answer.statusText,
    headers: returned,
  });
};
