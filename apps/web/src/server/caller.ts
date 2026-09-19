import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * The caller's cookie, taken from the request being handled.
 *
 * One place, because there is exactly one right answer inside a request and it
 * was a parameter at every call site once — which turned the thing that must
 * never be forgotten into one somebody could pass wrong.
 *
 * Only the cookie. Handing a whole header set to an internal service sends
 * `host`, `content-length` and whatever a proxy added, none of which describes
 * who is asking.
 */
export const callerCookie = (): string => getRequestHeader("cookie") ?? "";

/**
 * The same thing shaped for better-auth's client, which takes `fetchOptions`.
 *
 * In a browser the client picks the cookie up ambiently; on the server there is
 * no ambient anything, only the request being handled, so forwarding it is the
 * whole job. `server/session.ts` has done this for the session since SSR
 * landed; this is the same move for the rest of better-auth's endpoints.
 */
export const asCaller = (): {
  readonly fetchOptions: { readonly headers: { readonly cookie: string; }; };
} => ({
  fetchOptions: { headers: { cookie: callerCookie() } },
});
