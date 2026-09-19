import { identitySerial } from "@/atom/session-atoms.js";
import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { membersSerial, rolesSerial } from "@vantion/core/atoms/Access";
import { billingSerial } from "@vantion/core/atoms/Billing";
import { contactsSerial, overviewSerial } from "@vantion/core/atoms/Contact";
import { filesSerial } from "@vantion/core/atoms/File";
import { apiKeysSerial, auditLogSerial } from "@vantion/core/atoms/Organization";

/**
 * Every read that belongs in the document, as a server function per route.
 *
 * The rule this file exists to hold: **a GET is rendered on the server.** A
 * dashboard whose data is fetched after hydration shows a spinner for work the
 * server could already have done, and a spinner standing in for a list is the
 * thing a person waits on twice — once for the page, once for its contents.
 *
 * What stays on the client is what a person asks for: creating, editing,
 * deleting, and the refetch that follows one. Those are atoms and stay atoms.
 *
 * The cookie is forwarded explicitly because there is no ambient one here, the
 * same way `server/session.ts` does it. Each of these is one internal request
 * to a service this app cannot render a page without anyway.
 */

const cookie = () => getRequestHeader("cookie");

export const listContacts = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(
    contactsSerial,
    await serverRpc(cookie(), (client) => client("ListContacts", undefined)),
  )
);

export const getOverview = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(overviewSerial, await serverRpc(cookie(), (client) => client("GetOverview", undefined)))
);

export const listFiles = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(filesSerial, await serverRpc(cookie(), (client) => client("ListFiles", undefined)))
);

export const listMembers = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(membersSerial, await serverRpc(cookie(), (client) => client("ListMembers", undefined)))
);

export const listRoles = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(rolesSerial, await serverRpc(cookie(), (client) => client("ListRoles", undefined)))
);

export const listApiKeys = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(apiKeysSerial, await serverRpc(cookie(), (client) => client("ListApiKeys", undefined)))
);

export const getBilling = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(billingSerial, await serverRpc(cookie(), (client) => client("GetBilling", undefined)))
);

/**
 * A hundred, matching `auditLogAtom` exactly. A loader that fetched fifty would
 * hydrate a shorter list than the atom asks for, and the page would silently
 * grow the first time anything invalidated it.
 */
export const listAuditLog = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(
    auditLogSerial,
    await serverRpc(cookie(), (client) => client("ListAuditLog", { limit: 100 })),
  )
);

/**
 * Who the caller is, which every protected page needs and none should wait for.
 *
 * `_protected` already resolves better-auth's session to decide the redirect;
 * this is the other half — the organization, the role, and the permissions that
 * follow from it, which live in this product's own tables rather than in the
 * auth provider's.
 */
export const getIdentity = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(identitySerial, await serverRpc(cookie(), (client) => client("Me", undefined)))
);
