import type { MemberOverride } from "@vantion/module-iam/access/AccessRpc";
import { CustomRole, OrganizationMember } from "@vantion/module-iam/access/AccessRpc";
import type { Permission } from "@vantion/module-iam/identity/Permission";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { AppRpc } from "../AppRpc.js";
import { Keys } from "../Keys.js";

/**
 * Serialization metadata for the reads this app renders on the server.
 *
 * A key and a schema are what `Atom.serializable` needs, and the server needs
 * the same pair to encode. Declared here beside the atom so the two halves
 * cannot drift — a mismatched key hydrates nothing and the page quietly fetches
 * again, which looks exactly like it working.
 */
export const rolesSerial = {
  key: "roles",
  schema: AsyncResult.Schema({ success: Schema.Array(CustomRole) }),
};

export const rolesAtom = Atom.withReactivity([Keys.organization, Keys.roles])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListRoles", undefined);
    }),
  ),
).pipe(Atom.serializable(rolesSerial));

export const membersSerial = {
  key: "members",
  schema: AsyncResult.Schema({ success: Schema.Array(OrganizationMember) }),
};

export const membersAtom = Atom.withReactivity([Keys.organization, Keys.members])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListMembers", undefined);
    }),
  ),
).pipe(Atom.serializable(membersSerial));

/** Overrides for one member, keyed so each member gets its own atom. */
export const memberOverridesAtom = Atom.family((memberId: string) =>
  Atom.withReactivity([Keys.organization, Keys.overrides])(
    AppRpc.runtime.atom(
      Effect.gen(function*() {
        const client = yield* AppRpc;

        return yield* client("ListMemberOverrides", { memberId });
      }),
    ),
  )
);

/**
 * Editing a role also invalidates `members`: the member table renders the role
 * each member holds, so it is stale the moment a role's permissions change.
 */
export const setRoleAtom = AppRpc.runtime.fn<CustomRole>()(
  (role) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("SetRole", { role });
    }),
  { reactivityKeys: [Keys.roles, Keys.members] },
);

export const deleteRoleAtom = AppRpc.runtime.fn<string>()(
  (role) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("DeleteRole", { role });
    }),
  { reactivityKeys: [Keys.roles, Keys.members] },
);

export const setOverrideAtom = AppRpc.runtime.fn<MemberOverride>()(
  (override) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("SetMemberOverride", { override });
    }),
  { reactivityKeys: [Keys.overrides] },
);

export const clearOverrideAtom = AppRpc.runtime.fn<
  { readonly memberId: string; readonly permission: Permission; }
>()(
  (input) =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ClearMemberOverride", input);
    }),
  { reactivityKeys: [Keys.overrides] },
);
