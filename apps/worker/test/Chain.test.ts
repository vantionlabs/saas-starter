import { dispatch } from "#src/Handlers.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { JobQueue } from "@vantion/module-jobs/JobQueue";
import { relayOnce } from "@vantion/module-jobs/Relay";
import { register } from "@vantion/module-webhooks/Endpoints";
import { SIGNATURE_HEADER, verify } from "@vantion/module-webhooks/Signature";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";
import * as http from "node:http";
import type { AddressInfo } from "node:net";

const ORG = "org_chain";

const receiver = () => {
  const received: Array<{ readonly headers: http.IncomingHttpHeaders; readonly body: string; }> =
    [];

  const server = http.createServer((request, response) => {
    const chunks: Array<Buffer> = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({ headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
      response.writeHead(200).end();
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

const live = Layer.mergeAll(
  ContactStore.layer,
  JobQueue.layerMemory,
  FetchHttpClient.layer,
  Layer.succeed(CurrentUser)(
    new Identity({
      userId: UserId.make("user_chain"),
      orgId: OrgId.make(ORG),
      email: "chain@example.com",
      emailVerified: true,
      role: "owner",
      permissions: Array.from(permissionsFor("owner")),
    }),
  ),
).pipe(Layer.provideMerge(PgLive), Layer.provideMerge(PgPoolTest));

/**
 * The whole chain, in one test.
 *
 * Every link has its own test — the outbox commits with the write, the relay
 * moves rows once, delivery signs what it sends — and none of them proves they
 * are connected. This creates a contact through the real store and asserts that
 * somebody else's HTTP server received a signed delivery for it.
 */
describe.skipIf(testDbUrl() === undefined)("contact to webhook", () => {
  it.layer(live)("end to end", (it) => {
    it.effect("delivers a signed contact.created to a registered endpoint", () =>
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
                   values (${ORG}, ${ORG}, ${ORG}, now()) on conflict ("id") do nothing`;
        yield* sql`delete from "webhookDelivery" where "organizationId" = ${ORG}`;
        yield* sql`delete from "webhookEndpoint" where "organizationId" = ${ORG}`;
        yield* sql`delete from "outboxEvent" where "organizationId" = ${ORG}`;
        yield* sql`delete from "contact" where "organizationId" = ${ORG}`;

        const server = receiver();
        const url = yield* Effect.promise(() => server.listen());
        const endpoint = yield* register(url);

        // The write. Everything after this is the machinery under test.
        const contacts = yield* ContactStore;
        yield* contacts.create({ email: "chained@example.test", fullName: "Chained" });

        yield* relayOnce();
        const queue = yield* JobQueue;
        for (const job of yield* queue.drain) yield* dispatch(job);

        yield* Effect.promise(() => server.close());

        expect(server.received).toHaveLength(1);

        const delivery = server.received[0];
        expect(
          verify({
            secret: endpoint.secret,
            body: delivery?.body ?? "",
            header: String(delivery?.headers[SIGNATURE_HEADER] ?? ""),
          }),
        ).toBeUndefined();

        const envelope = JSON.parse(delivery?.body ?? "{}") as {
          type: string;
          data: { email: string; };
        };
        expect(envelope.type).toBe("contact.created");
        expect(envelope.data.email).toBe("chained@example.test");

        const recorded = yield* sql<{ status: string; }>`
          select "status" from "webhookDelivery" where "organizationId" = ${ORG}
        `;
        expect(recorded[0]?.status).toBe("delivered");
      }));
  });
});
