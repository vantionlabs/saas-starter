import { crossTenantReads } from "@vantion/telemetry/Metrics";
import { Effect, Metric, Schema } from "effect";
import type { SqlError } from "effect/unstable/sql";
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
export const crossTenant = <A, R>(
  action: CrossTenantAction,
  read: (sql: typeof AdminSql.Service) => Effect.Effect<A, SqlError.SqlError, R>,
): Effect.Effect<A, ReasonRequired, R | AdminSql | CurrentStaff> =>
  Effect.gen(function*() {
    const sql = yield* AdminSql;
    const staff = yield* CurrentStaff;

    if (action.reason.trim() === "") return yield* new ReasonRequired();

    /**
     * A failing query is a defect here, not a case a screen handles.
     *
     * `ReasonRequired` is the one thing a caller can do something about, so it
     * is the only thing in the error channel. Everything else — the connection
     * gone, a query wrong, the audit insert refused — is the admin surface
     * being broken, and `RULES.md` is clear that those become defects rather
     * than travelling as failures nobody will catch.
     */
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

        /**
         * `adminAudit` is the record of *which* reads and why; this is the
         * shape of the curve. A support surface used twice a day that is
         * suddenly used two hundred times is worth a page, and a row-level
         * trail does not make that visible on its own.
         */
        /**
         * The tenant's own copy, when the action concerned exactly one tenant.
         *
         * `adminAudit` answers "what has staff been doing"; this answers the
         * question a *customer* asks, from the screen they already read
         * everything else in. A transparency record they have to ask us for is
         * not one.
         *
         * Written in the same transaction as the staff record and the read, so
         * the three cannot disagree. It goes through `AdminSql` because there is
         * no session here — the role holds BYPASSRLS, which is what lets a row
         * be written into a tenant nobody is scoped to.
         *
         * The **reason is included**, deliberately. "Support looked at your
         * data" without why is a notification rather than an explanation, and
         * the reference is usually the customer's own ticket. A deployment
         * whose staff investigate abuse may want it redacted; that is this one
         * line, and `docs/admin.md` says so.
         */
        if (action.organizationId !== undefined) {
          /**
           * `select … where exists`, not `values`.
           *
           * Staff follow stale links, and `auditEntry.organizationId` has a
           * foreign key — correctly, because it is a tenant-owned table and a
           * row for an organization that is gone belongs to nobody and can be
           * read by nobody. Writing it unconditionally turned a 404 into a
           * constraint error and took the staff record down with it.
           *
           * So: if there is a tenant, tell them. If there is not, the attempt
           * is still in `adminAudit`, which is where it matters.
           */
          yield* sql`
            insert into "auditEntry"
              ("id", "organizationId", "actorUserId", "actorEmail", "actorRole",
               "action", "outcome", "detail")
            select
              ${randomUUID()}, ${action.organizationId}, ${staff.userId}, ${staff.email},
              'staff', ${action.action}, 'ok', ${action.reason}
            where exists (
              select 1 from "organization" where "id" = ${action.organizationId}
            )
          `;
        }

        yield* Metric.update(
          Metric.withAttributes(crossTenantReads, { action: action.action }),
          1,
        );

        return yield* read(sql);
      }),
    ).pipe(Effect.orDie);
  });
