import { Effect, Schema } from "effect";
import { randomUUID } from "node:crypto";
import { AdminSql } from "./AdminSql.js";
import { CurrentStaff } from "./Staff.js";

/**
 * What a staff member is about to do, and why.
 *
 * The reason is not optional and not derived. A support engineer opening a
 * customer's data should have to type the ticket number, and a log of reads
 * with no reasons in it is one nobody can review — every line says somebody
 * looked, and none says whether they should have.
 */
export class CrossTenantAction extends Schema.Class<CrossTenantAction>("CrossTenantAction")({
  /** What was done, in the same vocabulary the RPC uses: `ListOrganizations`. */
  action: Schema.String,
  /**
   * The organization this concerned, when it concerned exactly one. Absent for
   * a genuinely cross-tenant read such as listing every organization.
   */
  organizationId: Schema.optional(Schema.String),
  reason: Schema.String,
}) {}

export class ReasonRequired extends Schema.TaggedError<ReasonRequired>()("ReasonRequired", {}) {}

/**
 * The only way to read across tenants, and it leaves a record every time.
 *
 * Two things happen that do not happen anywhere else in this codebase. The
 * query runs on `AdminSql` — the connection holding BYPASSRLS — and before it
 * runs, a row is written saying who is about to look at what and why.
 *
 * The order matters. The record is written **first**, and in the same
 * transaction, so a read that succeeds cannot have gone unrecorded: if the
 * audit write fails the read does not happen, and if the read fails the record
 * rolls back with it. Writing afterwards would mean a crash mid-query leaves a
 * customer's data read and nothing saying so, which is the one outcome this
 * whole arrangement exists to prevent.
 *
 * It is also why this takes the action rather than returning a client. A
 * function handing back `AdminSql` would be a function somebody could call once
 * and then use forever.
 */
export const crossTenant = <A, E, R>(
  action: CrossTenantAction,
  read: (sql: typeof AdminSql.Service) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | ReasonRequired, R | AdminSql | CurrentStaff> =>
  Effect.gen(function*() {
    const sql = yield* AdminSql;
    const staff = yield* CurrentStaff;

    if (action.reason.trim() === "") return yield* new ReasonRequired();

    return yield* sql.withTransaction(
      Effect.gen(function*() {
        yield* sql`
          insert into "adminAudit"
            ("id", "staffUserId", "staffEmail", "action", "organizationId", "reason")
          values (
            ${randomUUID()}, ${staff.userId}, ${staff.email}, ${action.action},
            ${action.organizationId ?? null}, ${action.reason}
          )
        `;

        return yield* read(sql);
      }),
    ).pipe(Effect.catchTag("SqlError", (error) => Effect.die(error)));
  });
