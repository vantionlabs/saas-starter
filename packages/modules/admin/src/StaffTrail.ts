import { Effect } from "effect";
import { StaffTrailEntry } from "./AdminRpc.js";
import { AdminSql } from "./AdminSql.js";
import { CurrentStaff } from "./Staff.js";

/**
 * Reading the staff trail itself, which is the one privileged read that is not
 * a cross-tenant read.
 *
 * `crossTenant` is the door for customer data and this deliberately is not it,
 * for two reasons that both point the same way.
 *
 * **It would record itself.** Every read through `crossTenant` writes an
 * `adminAudit` row, so reading `adminAudit` through it appends a row saying the
 * log was read — and the next review reads that one too. A trail whose bulk is
 * the history of people looking at the trail is one nobody can find anything
 * in, and the growth is unbounded in the one table that must stay readable.
 *
 * **It would ask for a reason.** A ticket number is the right price for opening
 * a customer's records; it is the wrong price for oversight. Making somebody
 * justify checking what their colleagues have been doing is how a review
 * culture stops, and this is the table that exists to be reviewed.
 *
 * What it keeps from `crossTenant` is the part that matters: `CurrentStaff` is
 * still required, so this is staff-only, and the connection is still the one
 * holding BYPASSRLS — `adminAudit`'s policy is `using (false)`, so the
 * application role cannot read a row of it no matter who is asking.
 *
 * It takes no query. Unlike `crossTenant` this is not generic over a read, and
 * that is the whole of why a second door is safe: there is nothing to pass it.
 * A generic version would be an unaudited way to reach every table, which is
 * exactly what `crossTenant` was shaped to prevent.
 */
export const listStaffTrail = (
  limit: number,
): Effect.Effect<Array<StaffTrailEntry>, never, AdminSql | CurrentStaff> =>
  Effect.gen(function*() {
    const sql = yield* AdminSql;
    /**
     * Yielded and discarded. Nothing here reads the staff member — the trail is
     * the same for all of them, and narrowing it to your own entries would make
     * the table useless for the only thing it is for. What this asserts is that
     * there *is* one, so the requirement is in the type and the handler cannot
     * be wired up without a resolved staff identity.
     */
    yield* CurrentStaff;

    const rows = yield* sql<{
      id: string;
      staffEmail: string;
      action: string;
      organizationId: string | null;
      reason: string;
      at: Date;
    }>`
      select "id", "staffEmail", "action", "organizationId", "reason", "at"
      from "adminAudit"
      order by "at" desc
      limit ${limit}
    `.pipe(Effect.orDie);

    return rows.map((row) =>
      new StaffTrailEntry({
        id: row.id,
        staffEmail: row.staffEmail,
        action: row.action,
        organizationId: row.organizationId ?? undefined,
        reason: row.reason,
        at: row.at.toISOString(),
      })
    );
  });
