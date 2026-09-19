import { Effect } from "effect";
import { PersonMembership, PersonNotFound, PersonProfile } from "./AdminRpc.js";
import { crossTenant } from "./CrossTenant.js";

/**
 * Finding one person, which is the question support actually arrives with.
 *
 * Somebody emails about a problem and the first thing nobody can answer is
 * *which tenant are they in* — the address is all the ticket has, and every
 * other screen here is organized by organization.
 *
 * **Exact match, never a prefix.** `where lower("email") = lower($1)` and
 * nothing else: `like '%acme%'` would turn this into an enumeration tool that
 * lists every customer at a domain, from a screen whose whole point is that it
 * is audited and narrow. Somebody who already has the address learns nothing
 * they did not bring with them; somebody fishing gets nothing at all.
 *
 * What comes back is who they are and which organizations they belong to, which
 * is what routes a ticket. Their rows are not here and are not the point —
 * `GetOrganization` is where counts live, and it names the organization in the
 * record when staff go there next.
 */
export const findPerson = (email: string, reason: string) =>
  crossTenant(
    { action: "FindPerson", reason },
    (sql) =>
      Effect.all([
        sql<{
          id: string;
          email: string;
          name: string;
          emailVerified: boolean;
          banned: boolean | null;
          role: string | null;
          createdAt: Date;
        }>`
          select "id", "email", "name", "emailVerified", "banned", "role", "createdAt"
          from "user"
          where lower("email") = lower(${email})
        `,
        /**
         * Joined on the address rather than on an id resolved first, so the two
         * queries do not have to agree about a person existing. One round trip
         * each, both inside the transaction that already recorded the read.
         */
        sql<{ organizationId: string; name: string; slug: string; role: string; }>`
          select o."id" as "organizationId", o."name", o."slug", m."role"
          from "member" m
          join "organization" o on o."id" = m."organizationId"
          join "user" u on u."id" = m."userId"
          where lower(u."email") = lower(${email})
          order by o."name"
        `,
      ]),
  ).pipe(
    Effect.flatMap(([people, memberships]) => {
      const person = people[0];

      if (person === undefined) return Effect.fail(new PersonNotFound());

      return Effect.succeed(
        new PersonProfile({
          id: person.id,
          email: person.email,
          name: person.name,
          emailVerified: person.emailVerified,
          banned: person.banned ?? false,
          /**
           * Whether *this* person is staff, which is the one thing on this
           * screen that is about us rather than about a customer. A support
           * engineer looking up a colleague should see that they are one.
           */
          staff: person.role !== null,
          createdAt: person.createdAt.toISOString(),
          memberships: memberships.map((membership) =>
            new PersonMembership({
              organizationId: membership.organizationId,
              name: membership.name,
              slug: membership.slug,
              role: membership.role,
            })
          ),
        }),
      );
    }),
  );
