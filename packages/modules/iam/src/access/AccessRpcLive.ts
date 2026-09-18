import { Layer } from "effect";
import { ClearMemberOverride } from "./ClearMemberOverride.js";
import { DeleteRole } from "./DeleteRole.js";
import { ListMemberOverrides } from "./ListMemberOverrides.js";
import { ListMembers } from "./ListMembers.js";
import { ListRoles } from "./ListRoles.js";
import { SetMemberOverride } from "./SetMemberOverride.js";
import { SetRole } from "./SetRole.js";

/**
 * Managing access control.
 *
 * One file per operation, each its own layer: `toLayerHandler` implements a
 * single procedure, so what a handler needs is declared by that handler rather
 * than by whatever else happens to share a closure with it. Adding one is a new
 * file and a line here.
 *
 * Every statement is scoped by the caller's own `orgId` from `CurrentUser` — no
 * handler takes an organization as a payload, so one organization can never
 * read or rewrite another's roles. `memberPermission` is additionally covered
 * by row-level security through `withOrgScope`.
 */
export const AccessRpcLive = Layer.mergeAll(
  ListRoles,
  SetRole,
  DeleteRole,
  ListMembers,
  ListMemberOverrides,
  SetMemberOverride,
  ClearMemberOverride,
);
