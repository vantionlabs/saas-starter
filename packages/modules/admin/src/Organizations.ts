import { Effect } from "effect";
import {
  OrganizationDetail,
  OrganizationHealth,
  OrganizationNotFound,
  OrganizationSummary,
  SubscriptionSummary,
} from "./AdminRpc.js";
import { crossTenant } from "./CrossTenant.js";

/**
 * The procedures themselves, as plain effects.
 *
 * Separate from the RPC handlers because they have two callers, and the second
 * one is not over a wire: the admin application serves its own pages from the
 * process that holds the admin connection, so a transport between them would be
 * a contract with itself. `AdminRpcs` is the *other* transport — for a client
 * that is not the page this process rendered.
 *
 * One implementation, two ways in. The same rule `apps/mcp` follows for the
 * agent toolkit.
 */

const summary = (row: {
  id: string;
  name: string;
  slug: string;
  members: string;
  plan: string | null;
  createdAt: Date;
}) =>
  new OrganizationSummary({
    id: row.id,
    name: row.name,
    slug: row.slug,
    members: Number(row.members),
    // No subscription row is the free plan, the same reading
    // `EntitlementResolver` gives it.
    plan: row.plan ?? "free",
    createdAt: row.createdAt.toISOString(),
  });

/**
 * Every organization, which is the one read that genuinely has no tenant.
 *
 * `organizationId` is therefore absent from the audit record rather than
 * guessed at — "they listed everybody" is the honest entry, and naming one
 * would make the trail harder to read rather than easier.
 */
export const listOrganizations = (reason: string) =>
  crossTenant(
    { action: "ListOrganizations", reason },
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
  ).pipe(Effect.map((rows) => rows.map(summary)));

/**
 * One organization, named in the audit record.
 *
 * Counts rather than contents: a support engineer answering "is their import
 * stuck" needs to know there are nine hundred contacts, not who they are. Every
 * number here is computed by the query and never a row it returns.
 */
export const getOrganization = (organizationId: string, reason: string) =>
  crossTenant(
    { action: "GetOrganization", organizationId, reason },
    (sql) =>
      sql<{
        id: string;
        name: string;
        slug: string;
        members: string;
        plan: string | null;
        createdAt: Date;
        contacts: string;
        files: string;
        apiKeys: string;
        webhookEndpoints: string;
        subStatus: string | null;
        subSeats: number | null;
        subPeriodEnd: Date | null;
        subCancelAtPeriodEnd: boolean | null;
        outboxPending: string;
        failedDeliveries: string;
        disabledEndpoints: string;
      }>`
        select
          o."id", o."name", o."slug", o."createdAt", s."plan",
          s."status" as "subStatus",
          s."seats" as "subSeats",
          s."currentPeriodEnd" as "subPeriodEnd",
          s."cancelAtPeriodEnd" as "subCancelAtPeriodEnd",
          (select count(*) from "member" m where m."organizationId" = o."id") as "members",
          (select count(*) from "contact" c where c."organizationId" = o."id") as "contacts",
          (select count(*) from "file" f where f."organizationId" = o."id") as "files",
          (select count(*) from "apiKey" k where k."organizationId" = o."id") as "apiKeys",
          (select count(*) from "webhookEndpoint" w where w."organizationId" = o."id")
            as "webhookEndpoints",
          -- Written and not yet relayed. A number that only grows is a stuck
          -- relay, which is the explanation for every webhook that never came.
          (select count(*) from "outboxEvent" e
            where e."organizationId" = o."id" and e."relayedAt" is null) as "outboxPending",
          (select count(*) from "webhookDelivery" d
            join "webhookEndpoint" we on we."id" = d."endpointId"
            where we."organizationId" = o."id" and d."status" = 'failed') as "failedDeliveries",
          (select count(*) from "webhookEndpoint" w
            where w."organizationId" = o."id" and w."active" = false) as "disabledEndpoints"
        from "organization" o
        left join "subscription" s on s."organizationId" = o."id"
        where o."id" = ${organizationId}
      `,
  ).pipe(
    Effect.map((rows) => rows[0]),
    Effect.flatMap((row) =>
      row === undefined
        /**
         * The record of the attempt is already written, and stays written.
         * Somebody did look, and a trail keeping only the successful reads
         * would be missing exactly the ones worth reviewing.
         */
        ? Effect.fail(new OrganizationNotFound())
        : Effect.succeed(
          new OrganizationDetail({
            organization: summary(row),
            contacts: Number(row.contacts),
            files: Number(row.files),
            apiKeys: Number(row.apiKeys),
            webhookEndpoints: Number(row.webhookEndpoints),
            /**
             * Null when there has never been a subscription, which is not the
             * same as a cancelled one and reads differently on the screen:
             * "never paid" against "stopped paying".
             */
            subscription: row.subStatus === null ? null : new SubscriptionSummary({
              plan: row.plan ?? "free",
              status: row.subStatus,
              seats: row.subSeats ?? 0,
              currentPeriodEnd: row.subPeriodEnd?.toISOString() ?? null,
              cancelAtPeriodEnd: row.subCancelAtPeriodEnd ?? false,
            }),
            health: new OrganizationHealth({
              outboxPending: Number(row.outboxPending),
              failedDeliveries: Number(row.failedDeliveries),
              disabledEndpoints: Number(row.disabledEndpoints),
            }),
          }),
        )
    ),
  );
