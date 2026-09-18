import { AccessRpcs } from "@vantion/module-iam/access/AccessRpc";
import { OrganizationRpcs } from "@vantion/module-iam/organization/OrganizationRpc";
import { IamRpcs } from "@vantion/module-iam/session/IamRpc";
import { ContactRpcs } from "./contact/ContactRpc.js";
import { HealthRpcs } from "./health/HealthRpc.js";

/**
 * Every RPC the application serves, as one group.
 *
 * Both ends need the same list — the server to mount handlers, the client to
 * build a request. Keeping the merge here rather than in each of them is what
 * stops the two drifting: a group added to one and not the other becomes a
 * compile error rather than a call that fails at runtime.
 *
 * It also lets the client hold a single RPC client. Each group previously meant
 * its own client, protocol layer and atom runtime, all pointed at the same
 * endpoint.
 */
export const AppRpcs = HealthRpcs
  .merge(IamRpcs)
  .merge(OrganizationRpcs)
  .merge(AccessRpcs)
  .merge(ContactRpcs);
