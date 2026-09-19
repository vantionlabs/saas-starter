import { Layer } from "effect";
import { GetOrganization } from "./GetOrganization.js";
import { ListOrganizations } from "./ListOrganizations.js";

export const AdminRpcLive = Layer.mergeAll(ListOrganizations, GetOrganization);
