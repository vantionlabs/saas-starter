import { identitySerial } from "@/atom/session-atoms.js";
import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";

/**
 * Who the caller is, which every protected page needs and none should wait for.
 *
 * `_protected` already resolves better-auth's session to decide the redirect;
 * this is the other half — the organization, the role, and the permissions that
 * follow from it, which live in this product's own tables rather than in the
 * auth provider's.
 */
export const getIdentity = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(identitySerial, await serverRpc((client) => client("Me", undefined)))
);
