import type { GenericEndpointContext } from "better-auth";

/**
 * Which organization a SCIM request has been *authenticated* for.
 *
 * `@better-auth/scim` puts the provider it verified onto the endpoint context
 * before the handler runs, so by the time a user is about to be created this is
 * the organization the token actually belongs to — not one read out of the
 * bearer header.
 *
 * **That distinction is the whole reason this file exists.** The first version
 * of the seat check decoded the organization from the token in a `before` hook,
 * which runs ahead of the plugin's own middleware: it worked, and it answered a
 * *forged* token with "this organization has no seats left" instead of
 * "unauthorized". Small, but it is a fact about a tenant given to somebody who
 * failed to authenticate, and a test pinned it. Reading what the plugin has
 * already verified costs nothing and has no such shape.
 *
 * The property is not in better-auth's own types — the plugin augments the
 * context at runtime — so it is read defensively and returns `undefined` for
 * anything that is not a SCIM request.
 */
export const authenticatedScimOrganization = (
  context: GenericEndpointContext | null,
): string | undefined => {
  const provider = (context?.context as {
    scimProvider?: { organizationId?: unknown; } | undefined;
  } | undefined)?.scimProvider;

  const organizationId = provider?.organizationId;

  return typeof organizationId === "string" && organizationId !== ""
    ? organizationId
    : undefined;
};
