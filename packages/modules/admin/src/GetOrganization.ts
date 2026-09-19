import { Effect } from "effect";
import {
  AdminRpcs,
  OrganizationDetail,
  OrganizationNotFound,
  OrganizationSummary,
} from "./AdminRpc.js";
import { crossTenant } from "./CrossTenant.js";

/**
 * One organization, named in the audit record.
 *
 * Counts rather than contents: a support engineer answering "is their import
 * stuck" needs to know there are nine hundred contacts, not who they are. Every
 * count here is a number this query computes and never a row it returns.
 */
export const GetOrganization = AdminRpcs.toLayerHandler(
  "GetOrganization",
  (payload) =>
    crossTenant(
      {
        action: "GetOrganization",
        organizationId: payload.organizationId,
        reason: payload.reason,
      },
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
        }>`
          select
            o."id", o."name", o."slug", o."createdAt", s."plan",
            (select count(*) from "member" m where m."organizationId" = o."id") as "members",
            (select count(*) from "contact" c where c."organizationId" = o."id") as "contacts",
            (select count(*) from "file" f where f."organizationId" = o."id") as "files",
            (select count(*) from "apiKey" k where k."organizationId" = o."id") as "apiKeys",
            (select count(*) from "webhookEndpoint" w where w."organizationId" = o."id")
              as "webhookEndpoints"
          from "organization" o
          left join "subscription" s on s."organizationId" = o."id"
          where o."id" = ${payload.organizationId}
        `,
    ).pipe(
      Effect.map((rows) => rows[0]),
      Effect.flatMap((row) =>
        row === undefined
          /**
           * The record of the attempt is already written, and stays written.
           * Somebody did look, and a trail that kept only the successful reads
           * would be a trail missing exactly the ones worth reviewing.
           */
          ? Effect.fail(new OrganizationNotFound())
          : Effect.succeed(
            new OrganizationDetail({
              organization: new OrganizationSummary({
                id: row.id,
                name: row.name,
                slug: row.slug,
                members: Number(row.members),
                plan: row.plan ?? "free",
                createdAt: row.createdAt.toISOString(),
              }),
              contacts: Number(row.contacts),
              files: Number(row.files),
              apiKeys: Number(row.apiKeys),
              webhookEndpoints: Number(row.webhookEndpoints),
            }),
          )
      ),
    ),
);
