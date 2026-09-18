import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { OrganizationRpcs } from "../organization/OrganizationRpc.js";
import type { AuditOutcome } from "./Audit.js";
import { AuditEntry } from "./Audit.js";

export const ListAuditLog = OrganizationRpcs.toLayerHandler(
  "ListAuditLog",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;

    const rows = yield* withOrgScope(
      sql<{
        id: string;
        action: string;
        outcome: string;
        actorEmail: string;
        actorRole: string;
        detail: string;
        at: Date;
      }>`
        select "id", "action", "outcome", "actorEmail", "actorRole", "detail", "at"
        from "auditEntry"
        where "organizationId" = ${identity.orgId}
        order by "at" desc
        limit ${payload.limit}
      `,
    ).pipe(
      Effect.orDie,
      // Reading who did what is an administrative capability, not something
      // every member needs.
      withPolicy(permission("member:read")),
    );

    return rows.map((row) =>
      new AuditEntry({
        id: row.id,
        action: row.action,
        // Constrained by `auditEntry_outcome_check`, so the column cannot hold
        // anything else.
        outcome: row.outcome as AuditOutcome,
        actorEmail: row.actorEmail,
        actorRole: row.actorRole,
        detail: row.detail,
        at: DateTime.makeUnsafe(row.at),
      })
    );
  }),
);
