import { withWorkerScope } from "@vantion/database/OrgScope";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { asStatus, type SubscriptionEvent } from "./StripeClient.js";

/** What happened to an event, so a caller can say something useful about it. */
export type Applied =
  | "written"
  | "duplicate"
  | "stale"
  | "unplaceable";

/**
 * Writes what Stripe says about a subscription.
 *
 * Three things have to be true for this to be safe, and each is handled
 * separately because they fail separately:
 *
 * **Stripe redelivers.** `stripeEvent` is the ledger: an insert that conflicts
 * returns no rows, and that is the signal this event has already been dealt
 * with. Cheaper and more honest than making each write idempotent on its own.
 *
 * **Stripe sends events out of order.** A `canceled` delivered after the
 * `active` that replaced it would otherwise cancel a live subscription.
 * `lastEventCreated` holds Stripe's own timestamp for the event that last wrote
 * the row, and an older one is dropped.
 *
 * **The first event for a customer has no row to find.** Checkout puts the
 * organization on the subscription's metadata, which is the only thing linking a
 * Stripe customer to a tenant. Without it the event cannot be placed, and
 * guessing would mean writing somebody else's plan onto an organization.
 */
export const apply = Effect.fnUntraced(function*(event: SubscriptionEvent) {
  const sql = yield* SqlClient.SqlClient;

  return yield* withWorkerScope(
    Effect.gen(function*() {
      const ledger = yield* sql<{ id: string; }>`
        insert into "stripeEvent" ("id", "type") values (${event.id}, ${event.type})
        on conflict ("id") do nothing
        returning "id"
      `;

      if (ledger.length === 0) return "duplicate" as const;

      const existing = yield* sql<{ organizationId: string; lastEventCreated: string | null; }>`
        select "organizationId", "lastEventCreated" from "subscription"
        where "stripeCustomerId" = ${event.customerId}
      `;

      const row = existing[0];
      const organizationId = row?.organizationId ?? event.organizationId;

      if (organizationId === null || organizationId === undefined) return "unplaceable" as const;

      // Stripe's timestamps are seconds and arrive as a string from `bigint`.
      if (row?.lastEventCreated != null && Number(row.lastEventCreated) >= event.created) {
        return "stale" as const;
      }

      yield* sql`
        insert into "subscription"
          ("organizationId", "stripeCustomerId", "stripeSubscriptionId", "plan", "status",
           "seats", "lastEventCreated", "updatedAt")
        values (
          ${organizationId}, ${event.customerId}, ${event.subscriptionId},
          ${event.plan ?? "free"}, ${asStatus(event.status)},
          ${event.seats ?? 3}, ${event.created}, now()
        )
        on conflict ("organizationId") do update set
          "stripeCustomerId" = excluded."stripeCustomerId",
          "stripeSubscriptionId" = excluded."stripeSubscriptionId",
          "plan" = excluded."plan",
          "status" = excluded."status",
          "seats" = excluded."seats",
          "lastEventCreated" = excluded."lastEventCreated",
          "updatedAt" = now()
      `;

      return "written" as const;
    }),
  ).pipe(Effect.orDie);
});
