/**
 * Whether this application is willing to send somebody's events to a URL.
 *
 * A webhook endpoint is a URL a **customer** chooses and a **server of ours**
 * then fetches, which is the definition of server-side request forgery. Left
 * unchecked, `http://169.254.169.254/latest/meta-data/iam/` is a valid endpoint
 * and the delivery worker will happily fetch cloud credentials and post them to
 * the next one. So the check is here, at registration, in its own file with its
 * own tests, rather than inline in a handler where it reads like validation.
 *
 * **Two rules, and both are about what the worker can reach.**
 *
 * `https` only. A delivery is signed, but the signature protects the body, not
 * the transport — over plain HTTP the payload is readable by anything between
 * here and the receiver, and this product's events carry a tenant's own data.
 * The exception is `localhost`, because somebody developing against this needs
 * a receiver they can run, and a loopback address is not reachable from
 * anywhere that matters.
 *
 * No private, loopback or link-local hosts, which is the SSRF half. Loopback is
 * allowed only under the `http://localhost` exception above, and only when this
 * deployment says so.
 *
 * **What this does not do, said plainly:** a hostname check happens before DNS.
 * `evil.test` resolving to `10.0.0.1` passes here and is fetched anyway, and a
 * name that resolves differently on the second lookup defeats any check made on
 * the first. Closing that means refusing the connection rather than the string
 * — egress rules on the worker, or a proxy that will not route to private
 * space. This is the cheap half, and it is worth having because it catches the
 * accident and the casual attempt; `docs/webhooks.md` says what the other half
 * needs.
 */

/** Private, loopback and link-local space, plus the cloud metadata address. */
const BLOCKED_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

/**
 * Loopback by **any** spelling, which is the point of doing it separately from
 * the private-range check below: `localhost`, `127.0.0.1` and `[::1]` are the
 * same machine, and a rule that caught only the name would let the numeric form
 * fall through to the https check and be refused with the wrong reason.
 */
const isLoopback = (host: string) =>
  host === "localhost" || host.endsWith(".localhost")
  || /^127\./.test(host)
  || host === "[::1]" || host === "::1";

const isPrivateAddress = (host: string) =>
  BLOCKED_V4.some((pattern) => pattern.test(host))
  // Unique-local and link-local IPv6, which arrive bracketed in a URL host.
  || /^\[?(fc|fd|fe80)/i.test(host);

export type UrlRefusal = "NotAUrl" | "NotHttps" | "PrivateHost";

/**
 * `undefined` when the URL may be delivered to, otherwise why not.
 *
 * Returning the reason rather than a boolean is what lets the contract say
 * "use an https address" and "that address is on a private network" as
 * different sentences — somebody pasting a `http://` URL has made a different
 * mistake from somebody pasting their own router's.
 */
export const refuseUrl = (
  raw: string,
  options: { readonly allowLoopback: boolean; },
): UrlRefusal | undefined => {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return "NotAUrl";
  }

  const loopback = isLoopback(url.hostname);

  if (loopback) return options.allowLoopback ? undefined : "PrivateHost";
  if (url.protocol !== "https:") return "NotHttps";
  if (isPrivateAddress(url.hostname)) return "PrivateHost";

  return undefined;
};

/**
 * Whether a loopback endpoint is allowed at all.
 *
 * On by default outside production, because the first thing anybody does with
 * this is point it at a receiver on their own machine, and a starter that
 * refuses that is a starter nobody can try. `NODE_ENV=production` turns it off:
 * a deployed instance has no business delivering to its own loopback, which is
 * where its own unauthenticated internal services listen.
 */
export const loopbackAllowed = (): boolean => process.env["NODE_ENV"] !== "production";
