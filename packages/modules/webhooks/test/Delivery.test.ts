import { deliver } from "@/Delivery.js";
import { FAILURE_LIMIT, register } from "@/Endpoints.js";
import { ID_HEADER, SIGNATURE_HEADER, verify } from "@/Signature.js";
import { describe, expect, it } from "@effect/vitest";
import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";
import * as http from "node:http";
import type { AddressInfo } from "node:net";

const ORG = "org_webhooks";

/**
 * A real receiver rather than a mocked client.
 *
 * The thing worth proving is that somebody else's server can verify what we
 * send, and a stub that returns whatever we tell it proves only that we can call
 * our own code.
 */
const receiver = (status: number) => {
  const received: Array<{ readonly headers: http.IncomingHttpHeaders; readonly body: string; }> =
    [];

  const server = http.createServer((request, response) => {
    const chunks: Array<Buffer> = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({ headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
      response.writeHead(status).end();
    });
  });

  return {
    received,
    listen: () =>
      new Promise<string>((resolve) => {
        server.listen(0, "127.0.0.1", () =>
          resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`));
      }),
    close: () => new Promise<void>((resolve) => void server.close(() => resolve())),
  };
};

const asOrg = Layer.succeed(CurrentUser)(
  new Identity({
    userId: UserId.make("user_webhooks"),
    orgId: OrgId.make(ORG),
    email: "hooks@example.com",
    emailVerified: true,
    role: "owner",
    permissions: [],
  }),
);

const live = Layer.mergeAll(asOrg, FetchHttpClient.layer).pipe(
  Layer.provideMerge(PgLive),
  Layer.provideMerge(PgPoolTest),
);

const reset = Effect.fnUntraced(function*() {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${ORG}, ${ORG}, ${ORG}, now()) on conflict ("id") do nothing`;
  yield* withOrgScopeFor(
    ORG,
    Effect.gen(function*() {
      yield* sql`delete from "webhookDelivery" where "organizationId" = ${ORG}`;
      yield* sql`delete from "webhookEndpoint" where "organizationId" = ${ORG}`;
    }),
  );
});

const envelope = (id: string) => ({
  id,
  type: "contact.created" as const,
  createdAt: "2026-09-18T12:00:00.000Z",
  data: { id: "c1", email: "ada@example.test" },
});

const endpointRow = Effect.fnUntraced(function*(id: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* withOrgScopeFor(
    ORG,
    sql<{ active: boolean; consecutiveFailures: number; }>`
      select "active", "consecutiveFailures" from "webhookEndpoint" where "id" = ${id}
    `,
  );

  return rows[0];
});

describe.skipIf(testDbUrl() === undefined)("webhook delivery", () => {
  it.layer(live)("to a receiver that answers", (it) => {
    it.effect("signs the body so the receiver can verify it", () =>
      Effect.gen(function*() {
        yield* reset();
        const server = receiver(200);
        const url = yield* Effect.promise(() => server.listen());

        const endpoint = yield* register(url);
        yield* deliver({ organizationId: ORG, envelope: envelope("evt_1") });
        yield* Effect.promise(() => server.close());

        expect(server.received).toHaveLength(1);
        const delivery = server.received[0];

        // The assertion that matters: our own verifier, which is the one a
        // customer is told to use, accepts what our sender produced.
        expect(
          verify({
            secret: endpoint.secret,
            body: delivery?.body ?? "",
            header: String(delivery?.headers[SIGNATURE_HEADER] ?? ""),
          }),
        ).toBeUndefined();

        // And the id a receiver dedupes on is the event's, not a per-attempt one.
        expect(delivery?.headers[ID_HEADER]).toBe("evt_1");
      }));

    it.effect("records the delivery and clears the failure count", () =>
      Effect.gen(function*() {
        yield* reset();
        const server = receiver(202);
        const url = yield* Effect.promise(() => server.listen());

        const endpoint = yield* register(url);
        const result = yield* deliver({ organizationId: ORG, envelope: envelope("evt_2") });
        yield* Effect.promise(() => server.close());

        expect(result).toEqual({ attempted: 1, delivered: 1 });
        expect((yield* endpointRow(endpoint.id))?.consecutiveFailures).toBe(0);
      }));

    /**
     * The relay is at-least-once, so the same event reaches here more than once.
     * A second attempt must update the row rather than add one.
     */
    it.effect("does not record a second row when an event is redelivered", () =>
      Effect.gen(function*() {
        yield* reset();
        const server = receiver(200);
        const url = yield* Effect.promise(() => server.listen());
        yield* register(url);

        yield* deliver({ organizationId: ORG, envelope: envelope("evt_3") });
        yield* deliver({ organizationId: ORG, envelope: envelope("evt_3") });
        yield* Effect.promise(() => server.close());

        const sql = yield* SqlClient.SqlClient;
        const rows = yield* withOrgScopeFor(
          ORG,
          sql<{ attempts: number; }>`
            select "attempts" from "webhookDelivery" where "eventId" = 'evt_3'
          `,
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.attempts).toBe(2);
      }));
  });

  it.layer(live)("to a receiver that refuses", (it) => {
    it.effect("counts the failure and records what came back", () =>
      Effect.gen(function*() {
        yield* reset();
        const server = receiver(500);
        const url = yield* Effect.promise(() => server.listen());

        const endpoint = yield* register(url);
        const result = yield* deliver({ organizationId: ORG, envelope: envelope("evt_4") });
        yield* Effect.promise(() => server.close());

        expect(result).toEqual({ attempted: 1, delivered: 0 });
        expect((yield* endpointRow(endpoint.id))?.consecutiveFailures).toBe(1);

        const sql = yield* SqlClient.SqlClient;
        const rows = yield* withOrgScopeFor(
          ORG,
          sql<{ status: string; responseStatus: number; }>`
            select "status", "responseStatus" from "webhookDelivery" where "eventId" = 'evt_4'
          `,
        );
        expect(rows[0]?.status).toBe("failed");
        expect(rows[0]?.responseStatus).toBe(500);
      }));

    /**
     * The part everyone forgets. A receiver that has been gone for a week should
     * stop costing an attempt a minute forever.
     */
    it.effect("switches the endpoint off after enough consecutive failures", () =>
      Effect.gen(function*() {
        yield* reset();
        const server = receiver(503);
        const url = yield* Effect.promise(() => server.listen());
        const endpoint = yield* register(url);

        for (let attempt = 0; attempt < FAILURE_LIMIT; attempt += 1) {
          yield* deliver({ organizationId: ORG, envelope: envelope(`evt_off_${attempt}`) });
        }
        yield* Effect.promise(() => server.close());

        const row = yield* endpointRow(endpoint.id);
        expect(row?.consecutiveFailures).toBe(FAILURE_LIMIT);
        expect(row?.active).toBe(false);
      }));

    it.effect("treats an unreachable receiver as a failure rather than a crash", () =>
      Effect.gen(function*() {
        yield* reset();
        // Nothing is listening here: the server was never started.
        yield* register("http://127.0.0.1:1/hook");

        const result = yield* deliver({ organizationId: ORG, envelope: envelope("evt_5") });

        expect(result).toEqual({ attempted: 1, delivered: 0 });
      }));
  });
});
