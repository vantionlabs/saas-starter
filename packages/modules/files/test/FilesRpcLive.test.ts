import { FilesRpcs } from "@/FilesRpc.js";
import { FilesRpcLive } from "@/FilesRpcLive.js";
import { ObjectStore } from "@/ObjectStore.js";
import { describe, expect, it } from "@effect/vitest";
import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, Entitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer, Option } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

/** The bytes, as a store that keeps them in a map rather than on a disk. */
const objects = new Map<string, number>();

const storeFake: Layer.Layer<ObjectStore> = Layer.succeed(ObjectStore)({
  durable: true,
  presignUpload: (key) =>
    Effect.succeed({
      url: `https://storage.test/${key}`,
      method: "PUT" as const,
      headers: {},
    }),
  presignDownload: (key) => Effect.succeed(`https://storage.test/${key}?signed`),
  size: (key) => Effect.succeed(Option.fromUndefinedOr(objects.get(key))),
  remove: (key) => Effect.sync(() => void objects.delete(key)),
});

const identity = (org: string, role: string) =>
  new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role,
    permissions: Array.from(permissionsFor(role)),
  });

const as = (org: string, role: string, entitlement: Entitlement = free) =>
  FilesRpcLive.pipe(
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(CurrentUser, identity(org, role)),
            Effect.provideService(CurrentEntitlement, entitlement),
          )
        ),
      ),
    ),
    Layer.provideMerge(storeFake),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

const seedOrg = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
  yield* sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
             values (${`user_${org}`}, ${org}, ${`${org}@example.com`}, true, now(), now())
             on conflict ("id") do nothing`;
});

describe.skipIf(testDbUrl() === undefined)("FilesRpcLive", () => {
  it.layer(as("files_owner", "owner"))("uploading", (it) => {
    it.effect("takes two steps, and the second one checks", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(FilesRpcs);

        yield* seedOrg("files_owner");

        const ticket = yield* client.RequestUpload({
          name: "quarter.pdf",
          contentType: "application/pdf",
          size: 1024,
        });

        // The key is ours, and carries the organization as a prefix so a bucket
        // policy can be written against it.
        expect(ticket.url).toContain("files_owner/");

        // Nothing is listed until the bytes are confirmed: a ticket nobody used
        // leaves a pending row and nothing a customer can see.
        expect(yield* client.ListFiles()).toHaveLength(0);

        // What storage says, not what the client asked for.
        objects.set(`files_owner/${ticket.fileId}`, 2048);

        const file = yield* client.CompleteUpload({ id: ticket.fileId });

        expect(file.status).toBe("ready");
        expect(file.size).toBe(2048);
        expect((yield* client.ListFiles()).map((each) => each.name)).toEqual(["quarter.pdf"]);
      }));

    it.effect("refuses to complete an upload that never arrived", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(FilesRpcs);

        yield* seedOrg("files_owner");

        const ticket = yield* client.RequestUpload({
          name: "never-sent.pdf",
          contentType: "application/pdf",
          size: 10,
        });

        expect(yield* Effect.flip(client.CompleteUpload({ id: ticket.fileId }))).toMatchObject({
          _tag: "UploadIncomplete",
        });
      }));
  });

  it.layer(as("files_tenant_a", "owner"))("another tenant's file", (it) => {
    /**
     * The one that matters. Row-level security scopes the row, and the handlers
     * filter by organization as well — but the assertion worth writing is the
     * behavioural one: naming somebody else's id gets you nothing, and no way
     * to tell whether it exists.
     */
    it.effect("cannot be completed, downloaded or deleted by naming its id", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(FilesRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seedOrg("files_tenant_a");
        yield* seedOrg("files_tenant_b");
        yield* withOrgScopeFor(
          "files_tenant_b",
          sql`
            insert into "file" ("id", "organizationId", "key", "name", "contentType", "size", "status")
            values ('intruder', 'files_tenant_b', 'files_tenant_b/intruder', 'theirs.pdf',
                    'application/pdf', 99, 'ready')
            on conflict ("id") do nothing
          `,
        );
        objects.set("files_tenant_b/intruder", 99);

        expect(yield* Effect.flip(client.CompleteUpload({ id: "intruder" as never })))
          .toMatchObject({ _tag: "UploadIncomplete" });

        expect(yield* Effect.flip(client.GetDownloadUrl({ id: "intruder" as never })))
          .toMatchObject({ _tag: "StorageUnavailable" });

        // The delete succeeds — there is nothing here to delete — and the other
        // tenant's row and bytes are both still there.
        yield* client.DeleteFile({ id: "intruder" as never });

        const survivors = yield* withOrgScopeFor(
          "files_tenant_b",
          sql`select 1 from "file" where "id" = 'intruder'`,
        );
        expect(survivors).toHaveLength(1);
        expect(objects.get("files_tenant_b/intruder")).toBe(99);
      }));
  });

  it.layer(
    as("files_full", "owner", new Entitlement({ plan: "free", status: "active", seats: 3 })),
  )("the storage limit", (it) => {
    it.effect("refuses before signing rather than after the bytes land", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(FilesRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seedOrg("files_full");
        // 100 MB is the free plan's allowance, and this is all of it.
        yield* withOrgScopeFor(
          "files_full",
          sql`
            insert into "file" ("id", "organizationId", "key", "name", "contentType", "size", "status")
            values ('big', 'files_full', 'files_full/big', 'big.bin', 'application/octet-stream',
                    ${100 * 1024 * 1024}, 'ready')
            on conflict ("id") do update set "size" = excluded."size"
          `,
        );

        expect(
          yield* Effect.flip(
            client.RequestUpload({ name: "one-more.pdf", contentType: "application/pdf", size: 1 }),
          ),
        ).toMatchObject({ _tag: "LimitReached", limit: "storageMb", allowed: 100 });
      }));
  });

  it.layer(as("files_member", "member"))("a member", (it) => {
    it.effect("may upload and read, but not delete", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(FilesRpcs);

        yield* seedOrg("files_member");

        expect(yield* client.ListFiles()).toHaveLength(0);

        const ticket = yield* client.RequestUpload({
          name: "notes.txt",
          contentType: "text/plain",
          size: 12,
        });

        expect(yield* Effect.flip(client.DeleteFile({ id: ticket.fileId }))).toMatchObject({
          _tag: "Forbidden",
          required: "file:delete",
        });
      }));
  });
});
