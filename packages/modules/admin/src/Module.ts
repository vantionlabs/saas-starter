import { Layer } from "effect";
import { AdminRpcLive } from "./AdminRpcLive.js";
import { layerAdminSql } from "./AdminSql.js";
import { StaffResolver } from "./StaffResolver.js";

/**
 * What an admin application registers, and what nothing else should.
 *
 * It leaves `CurrentStaff` in its requirements on purpose: who is asking is the
 * host's to establish, the same way `SqlClient` and `Mailer` are elsewhere.
 * That is what keeps this module servable from an application with staff
 * sign-in without it having to know how sign-in works.
 *
 * `layerAdminSql` is provided here rather than left out, because there is
 * exactly one right answer for it and leaving it open would let a host supply
 * the application's own connection — which is the single thing this module
 * exists to prevent.
 */
export const AdminModule = AdminRpcLive.pipe(Layer.provideMerge(layerAdminSql));

export { StaffResolver };
