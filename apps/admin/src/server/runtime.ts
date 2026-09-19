import { PgPool } from "@vantion/database/PgPool";
import { AdminSql, layerAdminSql } from "@vantion/module-admin/AdminSql";
import { CurrentStaff } from "@vantion/module-admin/Staff";
import { StaffResolver } from "@vantion/module-admin/StaffResolver";
import { Effect, Layer, ManagedRuntime } from "effect";

/**
 * The one runtime this server holds, and the only place `ADMIN_DATABASE_URL`
 * is read.
 *
 * Built once per process rather than per request: a layer build is a connection
 * pool, and doing it per request would open one per page view.
 *
 * `AdminRpcLive` is deliberately absent. The RPC group is the transport for a
 * client that is *not* the page this process rendered, and this server is that
 * page's — so it calls the procedures directly. One implementation, two ways
 * in, and this app uses the one with no wire in it.
 *
 * `CurrentStaff` is absent too, and that is the load-bearing part: who is
 * asking changes every request, so it is provided per call. The type is
 * therefore what stops an admin procedure being run without somebody having
 * been resolved first.
 */
export const runtime = ManagedRuntime.make(
  Layer.mergeAll(layerAdminSql, StaffResolver.layer).pipe(Layer.provideMerge(PgPool.layer)),
);

/** Runs a procedure as a named staff member, which is the only way to run one. */
export const asStaff = <A, E>(
  staff: typeof CurrentStaff.Service,
  effect: Effect.Effect<A, E, AdminSql | CurrentStaff>,
): Promise<A> => runtime.runPromise(Effect.provideService(effect, CurrentStaff, staff));
