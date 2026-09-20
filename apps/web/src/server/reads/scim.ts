import { scimSerial } from "@/atom/scim-atoms.js";
import { authClient } from "@/iam/auth-client.js";
import { asCaller } from "@/server/caller.js";
import { dehydrate } from "@/server/hydration.js";
import { createServerFn } from "@tanstack/react-start";

/**
 * Every provisioning connection the caller administers, rendered on the server.
 *
 * Through the auth client rather than an RPC of ours, the way `listSsoProviders`
 * is: the endpoint already filters to organizations the caller holds the right
 * role in, and already returns three fields with the token not among them.
 */
export const listScimConnections = createServerFn({ method: "GET" }).handler(async () => {
  const result = await authClient.scim.listProviderConnections(asCaller());

  return dehydrate(
    scimSerial,
    (result.data?.providers ?? []).map((provider) => ({
      id: String(provider.id),
      providerId: String(provider.providerId),
      organizationId: typeof provider.organizationId === "string"
        ? provider.organizationId
        : null,
    })),
  );
});
