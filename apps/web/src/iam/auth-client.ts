import { ssoClient } from "@better-auth/sso/client";
import { emailOTPClient, magicLinkClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Where better-auth answers: the API, always.
 *
 * Every auth route lives on `apps/server`, so this is simply its address —
 * better-auth's own guidance is to set `baseURL` whenever the auth server is not
 * the app's own origin, and here it never is.
 *
 * `VITE_`-prefixed because the browser needs it. That is the only way Vite puts
 * a value in the client bundle, and it is honest about what this is: a public
 * address, not a secret. The same constant serves SSR, which resolves the
 * session in the server bundle.
 */
const baseURL = import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:3000";

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
  ],
});
