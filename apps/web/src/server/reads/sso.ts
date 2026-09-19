import { ssoSerial } from "@/atom/sso-atoms.js";
import { authClient } from "@/iam/auth-client.js";
import { asCaller } from "@/server/caller.js";
import { dehydrate } from "@/server/hydration.js";
import { createServerFn } from "@tanstack/react-start";

/**
 * Every provider the caller administers, narrowed to what the screen renders.
 *
 * Through the auth client rather than an RPC of our own: `/sso/providers`
 * already filters to what the caller administers and already strips the client
 * secret, so a procedure in front of it would be a second implementation of
 * both, free to disagree with the one that actually runs.
 */
export const listSsoProviders = createServerFn({ method: "GET" }).handler(async () => {
  const result = await authClient.sso.providers(asCaller());

  return dehydrate(
    ssoSerial,
    (result.data?.providers ?? []).map((provider) => ({
      organizationId: provider.organizationId,
      providerId: provider.providerId,
      domain: provider.domain,
      issuer: provider.issuer,
      domainVerified: provider.domainVerified,
    })),
  );
});
