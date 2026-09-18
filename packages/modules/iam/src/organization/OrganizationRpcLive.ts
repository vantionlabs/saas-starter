import { Layer } from "effect";
import { CreateApiKey } from "../apikey/CreateApiKey.js";
import { ListApiKeys } from "../apikey/ListApiKeys.js";
import { RevokeApiKey } from "../apikey/RevokeApiKey.js";
import { ListAuditLog } from "../audit/ListAuditLog.js";
import { CreateOrganization } from "./CreateOrganization.js";
import { DeleteOrganization } from "./DeleteOrganization.js";
import { ListMyOrganizations } from "./ListMyOrganizations.js";
import { RenameOrganization } from "./RenameOrganization.js";
import { SwitchOrganization } from "./SwitchOrganization.js";

/**
 * The organization group, assembled from the sub-domains that implement it.
 *
 * The group is a transport grouping, not a concern: keys and the audit log are
 * reachable from the organization settings screens and so share this group, but
 * they belong to `apikey/` and `audit/` and their handlers live there. A
 * procedure moving between groups should be a change to this file only.
 */
export const OrganizationRpcLive = Layer.mergeAll(
  ListMyOrganizations,
  CreateOrganization,
  SwitchOrganization,
  RenameOrganization,
  DeleteOrganization,
  ListApiKeys,
  CreateApiKey,
  RevokeApiKey,
  ListAuditLog,
);
