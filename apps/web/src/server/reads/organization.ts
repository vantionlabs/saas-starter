import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import {
  apiKeysSerial,
  auditLogSerial,
  organizationsSerial,
} from "@vantion/core/atoms/Organization";

export const listApiKeys = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(apiKeysSerial, await serverRpc((client) => client("ListApiKeys", undefined)))
);

/**
 * A hundred, matching `auditLogAtom` exactly. A loader fetching fifty would
 * hydrate a shorter list than the atom asks for, and the page would silently
 * grow the first time anything invalidated it.
 */
export const listAuditLog = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(
    auditLogSerial,
    await serverRpc((client) => client("ListAuditLog", { limit: 100 })),
  )
);

/** The organizations this caller belongs to, for the settings screen. */
export const listMyOrganizations = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(
    organizationsSerial,
    await serverRpc((client) => client("ListMyOrganizations", undefined)),
  )
);
