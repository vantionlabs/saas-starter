import { ApiKey } from "@vantion/module-iam/apikey/ApiKey";
import { AuditEntry } from "@vantion/module-iam/audit/Audit";
import type { OrgId } from "@vantion/module-iam/identity/Identity";
import type { Role } from "@vantion/module-iam/identity/Permission";
import { Membership } from "@vantion/module-iam/organization/OrganizationRpc";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { AppRpc } from "../AppRpc.js";
import { Keys } from "../Keys.js";

/** Rendered on the server; the key and schema are shared with its loader. */
export const organizationsSerial = {
  key: "organizations",
  schema: AsyncResult.Schema({ success: Schema.Array(Membership) }),
};

export const organizationsAtom = Atom.withReactivity([Keys.organization])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListMyOrganizations", undefined);
    }),
  ),
).pipe(Atom.serializable(organizationsSerial));

/**
 * Both writes invalidate `organization`, so the session, this list and every
 * org-scoped query re-read themselves once the switch actually lands. Keys are
 * only invalidated on success — a rejected switch leaves the UI on the
 * organization it is still in.
 */
export const switchOrganizationAtom = AppRpc.runtime.fn<OrgId>()(
  (orgId) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("SwitchOrganization", { orgId });
    }),
  { reactivityKeys: [Keys.organization] },
);

export const renameOrganizationAtom = AppRpc.runtime.fn<string>()(
  (name) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("RenameOrganization", { name });
    }),
  { reactivityKeys: [Keys.organization] },
);

/** Deleting the active organization moves the session, so everything re-reads. */
export const deleteOrganizationAtom = AppRpc.runtime.fn<string>()(
  (confirmName) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("DeleteOrganization", { confirmName });
    }),
  { reactivityKeys: [Keys.organization] },
);

/** Rendered on the server; the key and schema are shared with its loader. */
export const apiKeysSerial = {
  key: "apiKeys",
  schema: AsyncResult.Schema({ success: Schema.Array(ApiKey) }),
};

export const apiKeysAtom = Atom.withReactivity([Keys.organization, Keys.apiKeys])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListApiKeys", undefined);
    }),
  ),
).pipe(Atom.serializable(apiKeysSerial));

export const createApiKeyAtom = AppRpc.runtime.fn<
  { readonly name: string; readonly role: Role; }
>()(
  (input) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("CreateApiKey", input);
    }),
  { reactivityKeys: [Keys.apiKeys] },
);

export const revokeApiKeyAtom = AppRpc.runtime.fn<string>()(
  (id) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("RevokeApiKey", { id });
    }),
  { reactivityKeys: [Keys.apiKeys] },
);

/**
 * Rendered on the server. The limit is part of the read rather than a
 * parameter, so the loader and the atom ask for the same hundred rows — a
 * loader fetching fifty would hydrate a list the atom then replaces.
 */
export const auditLogSerial = {
  key: "auditLog",
  schema: AsyncResult.Schema({ success: Schema.Array(AuditEntry) }),
};

export const auditLogAtom = Atom.withReactivity([Keys.organization, Keys.audit])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListAuditLog", { limit: 100 });
    }),
  ),
).pipe(Atom.serializable(auditLogSerial));

export const createOrganizationAtom = AppRpc.runtime.fn<string>()(
  (name) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("CreateOrganization", { name });
    }),
  { reactivityKeys: [Keys.organization] },
);
