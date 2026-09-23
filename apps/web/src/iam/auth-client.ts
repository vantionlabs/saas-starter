import { apiOrigin } from "@/server/proxy.js";
import { scimClient } from "@better-auth/scim/client";
import { ssoClient } from "@better-auth/sso/client";
import { apiUrl } from "@vantion/core/ApiUrl";
import {
  emailOTPClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Where better-auth answers.
 *
 * In the browser, this origin: `/api/auth/*` is forwarded to the API by
 * `server/proxy.ts`, so the session cookie is first-party on whatever host
 * served the page and no address is compiled into the bundle. `apiUrl()` is the
 * page's origin unless an address was configured on purpose.
 *
 * On the server — the `/_protected` guard, resolving a session during SSR — the
 * API directly, over the private network: the same address the proxy forwards
 * to, so a server-rendered page does not go out to the edge and back.
 */
const baseURL = typeof window === "undefined" ? apiOrigin() : apiUrl();

/**
 * better-auth's own typed client — one of them, used from both sides.
 *
 * The available methods are inferred from the plugin set, so sign-in, magic
 * link and OTP are reached as `authClient.signIn.email(...)` rather than by
 * writing endpoint paths by hand. It also owns the session cookie, which is why
 * authentication is not an RPC procedure: a cookie is set by an HTTP response
 * header, and the ndjson RPC transport batches many results into one response.
 *
 * The server uses it too, for the `/_protected` guard — passing the incoming
 * request's cookie per call, since there is no ambient one to pick up. A second
 * client for that would be the same configuration twice, free to drift.
 *
 * Everything after authentication goes through the typed RPC client instead.
 */
export const authClient = createAuthClient({
  baseURL,
  plugins: [
    magicLinkClient(),
    emailOTPClient(),
    organizationClient(),
    /**
     * `domainVerification` must match the server's, and it is not decoration:
     * the client infers the registration response's shape from it, and
     * `domainVerificationToken` — the thing a new provider has to be proved
     * with — only appears when it is on. Nothing else would break, which is why
     * it is worth saying: the screen would simply have nothing to show, and the
     * provider would silently never route anybody.
     *
     * Neither half can be turned off quietly. Drop it here and
     * `settings/sso.tsx` stops compiling, because it reads that token. Drop it
     * on the server and `Sso.test.ts` fails, because it asserts the token comes
     * back.
     */
    ssoClient({ domainVerification: { enabled: true } }),

    /**
     * Directory provisioning, which is what an organization buys alongside
     * single sign-on: SSO decides who may sign in, SCIM decides who exists.
     *
     * Only the *management* endpoints are reached from a browser — list a
     * connection, issue a token, delete one. `/scim/v2/*` is spoken by an
     * identity provider with a bearer token and never by this client.
     */
    scimClient(),

    /**
     * Second factor, and the reason sign-in has a second page now.
     *
     * When an account has 2FA on, better-auth answers a correct password with
     * `twoFactorRedirect` rather than a session: the credentials were right and
     * the sign-in is not finished. The client sends the browser here, and
     * `/auth/two-factor` is the only place that can complete it — without this
     * option that response looks to a caller like a silent success followed by
     * no session, which is indistinguishable from a broken cookie.
     */
    twoFactorClient({ twoFactorPage: "/auth/two-factor" }),
  ],
});
