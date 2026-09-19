import { withOrgScopeFor, withWorkerScope } from "@vantion/database/OrgScope";
import type { Permission } from "@vantion/module-iam/identity/Permission";
import { toGrants } from "@vantion/module-iam/identity/Permission";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * One demo tenant, described rather than procedurally generated.
 *
 * The three mirror `apps/design`'s personas, so the running application and the
 * design canvas show the same three situations: a tenant on its first day, an
 * ordinary one, and the crowded one whose long names and many rows are what
 * actually break a layout.
 */
export interface Tenant {
  readonly name: string;
  readonly slug: string;
  /** The account that owns it. Members are added in the order given. */
  readonly owner: string;
  readonly members: ReadonlyArray<{ readonly email: string; readonly role: string; }>;
  readonly contacts: ReadonlyArray<{ readonly fullName: string; readonly email: string; }>;
  readonly plan: "free" | "pro" | "scale";
  readonly status: "active" | "past_due" | "canceled" | "none";
  /**
   * Typed against the real `Permission` union, so an invented one is a compile
   * error rather than a screen that dies on "Schema validation failed". The
   * first draft granted `audit:read`, `apikey:create` and `webhook:manage` —
   * none of which are resources this product has — and nothing said so until
   * the roles page refused to decode them.
   */
  readonly customRoles: ReadonlyArray<
    { readonly role: string; readonly permissions: ReadonlyArray<Permission>; }
  >;
  /** Left unrelayed, so the admin panel has an outbox to show as waiting. */
  readonly stuckEvents: number;
  readonly endpoints: ReadonlyArray<
    { readonly url: string; readonly active: boolean; readonly failures: number; }
  >;
}

const userIdFor = (email: string) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string; }>`select "id" from "user" where "email" = ${email}`;

    return rows[0]?.id;
  });

/**
 * The organization sign-up already made for this person, which is the one they
 * will be looking at.
 *
 * The seed **renames and fills** it rather than creating a fourth organization
 * beside it. That is not tidiness: better-auth makes every account a personal
 * organization and picks the active one at sign-in, so a tenant created on the
 * side would leave whoever signed in staring at their own empty org and hunting
 * for the switcher. Filling the one they land in is what makes this a seed
 * somebody can click through rather than one they have to navigate to.
 *
 * Their earliest owned organization, because that is the one the create hook
 * made — any later one would be a tenant a previous run had already set up.
 */
const personalOrgFor = (userId: string) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ organizationId: string; }>`
      select m."organizationId"
      from "member" m
      where m."userId" = ${userId} and m."role" = 'owner'
      order by m."createdAt" asc
      limit 1
    `;

    return rows[0]?.organizationId;
  });

export const seedTenant = Effect.fnUntraced(function*(tenant: Tenant) {
  const sql = yield* SqlClient.SqlClient;

  const ownerId = yield* userIdFor(tenant.owner);
  if (ownerId === undefined) return { skipped: tenant.owner };

  const orgId = yield* personalOrgFor(ownerId);
  if (orgId === undefined) return { skipped: tenant.owner };

  yield* sql`
    update "organization"
    set "name" = ${tenant.name}, "slug" = ${tenant.slug}
    where "id" = ${orgId}
  `;

  for (const member of tenant.members) {
    const userId = yield* userIdFor(member.email);
    if (userId === undefined) continue;

    yield* sql`
      insert into "member" ("id", "organizationId", "userId", "role", "createdAt")
      values (
        ${`m_${tenant.slug}_${userId}`}, ${orgId}, ${userId}, ${member.role},
        now() - interval '80 days'
      )
      on conflict ("id") do nothing
    `;
  }

  /**
   * One row per **role**, with the grants as JSON — better-auth's own shape,
   * which `ListRoles` reads back with `JSON.parse` and `fromGrants`.
   *
   * The first version of this wrote a row per permission holding the bare
   * string `contact:read`, and the roles screen died on
   * `Unexpected token 'c', "contact:read" is not valid JSON`. A fixture is only
   * as good as its fidelity to the thing that writes the row for real, so the
   * encoding here is `toGrants` — the product's own function — rather than a
   * shape guessed from the column name.
   */
  for (const custom of tenant.customRoles) {
    yield* sql`
      insert into "organizationRole" ("id", "organizationId", "role", "permission", "createdAt")
      values (
        ${`r_${tenant.slug}_${custom.role}`}, ${orgId}, ${custom.role},
        ${JSON.stringify(toGrants(custom.permissions))}, now()
      )
      on conflict ("id") do nothing
    `;
  }

  yield* withOrgScopeFor(
    orgId,
    Effect.gen(function*() {
      for (const [index, contact] of tenant.contacts.entries()) {
        yield* sql`
          insert into "contact" ("id", "organizationId", "email", "fullName")
          values (${`c_${tenant.slug}_${index}`}, ${orgId}, ${contact.email}, ${contact.fullName})
          on conflict ("id") do nothing
        `;
      }

      yield* sql`
        insert into "apiKey" ("id", "organizationId", "name", "hash", "hint", "role", "createdAt")
        values (
          ${`k_${tenant.slug}`}, ${orgId}, 'CI pipeline',
          -- Not a usable key: seeding one would mean printing a working
          -- credential, and the screen only ever shows the hint.
          ${`seed-not-a-real-key-${tenant.slug}`}, 'a7f2', 'member', now() - interval '30 days'
        )
        on conflict ("id") do nothing
      `;

      for (
        const [index, entry] of [
          { action: "contact.create", outcome: "ok", detail: "Seeded" },
          { action: "apikey.create", outcome: "ok", detail: "CI pipeline" },
          { action: "organization.update", outcome: "denied", detail: "Not an owner" },
        ].entries()
      ) {
        yield* sql`
          insert into "auditEntry"
            ("id", "organizationId", "actorUserId", "actorEmail", "actorRole",
             "action", "outcome", "detail", "at")
          values (
            ${`a_${tenant.slug}_${index}`}, ${orgId}, ${ownerId}, ${tenant.owner}, 'owner',
            ${entry.action}, ${entry.outcome}, ${entry.detail},
            now() - (${index} * interval '1 day')
          )
          on conflict ("id") do nothing
        `;
      }

      for (const [index, endpoint] of tenant.endpoints.entries()) {
        yield* sql`
          insert into "webhookEndpoint"
            ("id", "organizationId", "url", "secret", "active", "consecutiveFailures", "createdAt")
          values (
            ${`w_${tenant.slug}_${index}`}, ${orgId}, ${endpoint.url},
            ${`seed_secret_${tenant.slug}_${index}`}, ${endpoint.active}, ${endpoint.failures}, now()
          )
          on conflict ("id") do nothing
        `;
      }

      /**
       * Unrelayed on purpose. `relayedAt` null is what the admin panel counts
       * as an outbox waiting, and a tenant with a number there is the state
       * somebody is trying to recognise when a webhook never arrived.
       */
      for (let index = 0; index < tenant.stuckEvents; index += 1) {
        yield* sql`
          insert into "outboxEvent" ("id", "organizationId", "kind", "payload", "createdAt")
          values (
            ${`o_${tenant.slug}_${index}`}, ${orgId}, 'contact.created',
            ${JSON.stringify({ seeded: true })}::jsonb, now() - interval '2 hours'
          )
          on conflict ("id") do nothing
        `;
      }

      for (
        const [index, file] of [
          { name: "q3-report.pdf", contentType: "application/pdf", size: 184_320 },
          { name: "logo.png", contentType: "image/png", size: 24_576 },
        ].entries()
      ) {
        yield* sql`
          insert into "file"
            ("id", "organizationId", "key", "name", "contentType", "size", "status", "uploadedBy")
          values (
            ${`f_${tenant.slug}_${index}`}, ${orgId}, ${`${tenant.slug}/seed-${index}`},
            ${file.name}, ${file.contentType}, ${file.size}, 'ready', ${ownerId}
          )
          on conflict ("id") do nothing
        `;
      }
    }),
  );

  /**
   * The subscription is written under the **worker** scope, and that is the
   * schema talking rather than a shortcut: `subscription`'s `with check` is
   * worker-only, because Stripe's webhook is the only thing that may change a
   * plan. A customer who could write their own row could buy themselves a plan
   * by asking the API nicely.
   */
  if (tenant.status !== "none") {
    yield* withWorkerScope(
      sql`
        insert into "subscription"
          ("organizationId", "stripeCustomerId", "stripeSubscriptionId", "plan", "status",
           "seats", "currentPeriodEnd", "cancelAtPeriodEnd")
        values (
          ${orgId}, ${`cus_seed_${tenant.slug}`}, ${`sub_seed_${tenant.slug}`},
          ${tenant.plan}, ${tenant.status}, ${tenant.plan === "scale" ? 25 : 5},
          now() + interval '21 days', false
        )
        on conflict ("organizationId") do nothing
      `,
    );
  }

  return { seeded: tenant.slug };
});
