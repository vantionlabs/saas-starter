import { Effect } from "effect";
import { AdminRpcs, OrganizationSummary } from "./AdminRpc.js";
import { crossTenant } from "./CrossTenant.js";

/**
 * Every organization, which is the one read that genuinely has no tenant.
 *
 * `organizationId` is therefore absent from the audit record rather than
 * guessed at — "they listed everybody" is the honest entry, and pretending
 * otherwise would make the trail harder to read rather than easier.
 */
export const ListOrganizations = AdminRpcs.toLayerHandler(
  "ListOrganizations",
  (payload) =>
    crossTenant(
      { action: "ListOrganizations", reason: payload.reason },
      (sql) =>
        sql<{
          id: string;
          name: string;
          slug: string;
          members: string;
          plan: string | null;
          createdAt: Date;
        }>`
          select
            o."id", o."name", o."slug", o."createdAt",
            (select count(*) from "member" m where m."organizationId" = o."id") as "members",
            s."plan"
          from "organization" o
          left join "subscription" s on s."organizationId" = o."id"
          order by o."createdAt" desc
        `,
    ).pipe(
      Effect.map((rows) =>
        rows.map((row) =>
          new OrganizationSummary({
            id: row.id,
            name: row.name,
            slug: row.slug,
            members: Number(row.members),
            // No subscription row is the free plan, the same reading
            // `EntitlementResolver` gives it.
            plan: row.plan ?? "free",
            createdAt: row.createdAt.toISOString(),
          })
        )
      ),
    ),
);
