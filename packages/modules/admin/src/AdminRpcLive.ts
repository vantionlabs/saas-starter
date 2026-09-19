import { Layer } from "effect";
import { GetOrganization } from "./GetOrganization.js";
import { ListOrganizations } from "./ListOrganizations.js";
import { ListStaffTrail } from "./ListStaffTrail.js";

export const AdminRpcLive = Layer.mergeAll(ListOrganizations, GetOrganization, ListStaffTrail);
