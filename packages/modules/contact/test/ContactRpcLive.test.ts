import { ContactRpcs } from "@/ContactRpc.js";
import { ContactRpcLive } from "@/ContactRpcLive.js";
import { ContactStore } from "@/ContactStore.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

const as = (org: string) =>
  ContactRpcLive.pipe(
    Layer.provide(ContactStore.layer),
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          Effect.provideService(
            // Contacts are on every plan, so the free one is the honest default
            // here — and proves the feature gating does not reach past what it
            // was put in front of.
            Effect.provideService(effect, CurrentEntitlement, free),
            CurrentUser,
            new Identity({
              userId: UserId.make(`user_${org}`),
              orgId: OrgId.make(org),
              email: `${org}@example.com`,
              emailVerified: true,
              role: "owner",
              permissions: Array.from(permissionsFor("owner")),
            }),
          )
        ),
      ),
    ),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

describe.skipIf(testDbUrl() === undefined)("ContactRpcLive", () => {
  it.layer(as("org_events"))("events", (it) => {
    /**
     * The insert and its outbox row commit together, so a subscriber never hears
     * about a contact that was rolled back and a contact that exists always had
     * its event written. This asserts the second half; the first is in the jobs
     * module, which rolls a transaction back and finds nothing left behind.
     */
    it.effect("records contact.created in the same transaction as the contact", () =>
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
                   values ('org_events', 'org_events', 'org_events', now())
                   on conflict ("id") do nothing`;
        yield* sql`delete from "outboxEvent" where "organizationId" = 'org_events'`;
        yield* sql`delete from "contact" where "organizationId" = 'org_events'`;

        const client = yield* RpcTest.makeClient(ContactRpcs);
        yield* client.CreateContact({ email: "subscribed@example.com", fullName: "Subscribed" });

        const events = yield* sql<{ kind: string; payload: { email: string; }; }>`
          select "kind", "payload" from "outboxEvent" where "organizationId" = 'org_events'
        `;

        expect(events).toHaveLength(1);
        expect(events[0]?.kind).toBe("contact.created");
        expect(events[0]?.payload.email).toBe("subscribed@example.com");
      }));
  });

  it.layer(as("org_mine"))("tenant isolation", (it) => {
    /**
     * This is a regression test for a leak found in the running app.
     *
     * The handlers originally relied on row-level security alone. The test
     * database connects as a superuser — which ignores RLS entirely, exactly as
     * a misconfigured `DATABASE_URL` would — so another tenant's contacts were
     * counted on the dashboard. Running here *without* assuming an unprivileged
     * role is deliberate: it proves the explicit `organizationId` filters hold
     * on their own.
     */
    it.effect("never returns or counts another organization's contacts", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(ContactRpcs);
        const sql = yield* SqlClient.SqlClient;

        for (const org of ["org_mine", "org_theirs"]) {
          yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
                     values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
        }
        yield* sql`insert into "contact" ("id", "organizationId", "email", "fullName")
                   values ('c_theirs', 'org_theirs', 'them@example.com', 'Theirs')
                   on conflict ("id") do nothing`;

        yield* client.CreateContact({ email: "mine@example.com", fullName: "Mine" });

        const listed = yield* client.ListContacts();
        expect(listed.map((contact) => contact.fullName)).toEqual(["Mine"]);

        const overview = yield* client.GetOverview();
        expect(overview.contacts).toBe(1);

        // Naming another tenant's contact must not delete it either.
        yield* client.DeleteContact({ id: listed[0]!.id });
        const survivors = yield* sql`select 1 from "contact" where "id" = 'c_theirs'`;
        expect(survivors).toHaveLength(1);

        yield* sql`delete from "organization" where "id" in ('org_mine', 'org_theirs')`;
      }));
  });
});
