import { withWorkerScope } from "@vantion/database/OrgScope";
import type { SubscriptionStatus } from "@vantion/module-iam/identity/Entitlement";
import { Entitlement, free, type Plan } from "@vantion/module-iam/identity/Entitlement";
import { EntitlementResolver } from "@vantion/module-iam/identity/EntitlementResolver";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * What an organization is entitled to, read from its subscription.
 *
 * Worker-scoped, and unavoidably so: this runs while the session is still being
 * assembled, before there is an organization scope to read under — the same
 * position `ApiKeyAuth` is in, and the same escape. The statement is one select
 * by primary key and nothing else.
 *
 * An organization with no row is on the free plan rather than an error. Every
 * organization exists before it pays for anything, and a sign-up that failed
 * because billing had not caught up would be a bad first impression.
 */
export const layerDatabase: Layer.Layer<EntitlementResolver, never, SqlClient.SqlClient> = Layer
  .effect(EntitlementResolver)(
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;

      return {
        resolve: (subject) =>
          withWorkerScope(
            sql<{ plan: string; status: string; seats: number; }>`
              select "plan", "status", "seats" from "subscription"
              where "organizationId" = ${subject.organizationId}
            `,
          ).pipe(
            Effect.map((rows) => {
              const row = rows[0];
              if (row === undefined) return free;

              // Both columns are constrained by a check, so the database cannot
              // hold anything the schema does not name.
              return new Entitlement({
                plan: row.plan as Plan,
                status: row.status as SubscriptionStatus,
                seats: row.seats,
              });
            }),
            // A subscription that cannot be read must not take authentication
            // down with it. Falling back to free is the safe direction: it
            // withholds paid features rather than granting them.
            Effect.catchCause((cause) =>
              Effect.as(
                Effect.logError("could not resolve entitlement; falling back to free", cause),
                free,
              )
            ),
            Effect.provideService(SqlClient.SqlClient, sql),
          ),
      };
    }),
  );
