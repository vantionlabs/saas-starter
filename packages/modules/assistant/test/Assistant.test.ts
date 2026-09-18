import { AssistantRpcs } from "@/AssistantRpc.js";
import type { Chunk } from "@/AssistantRpc.js";
import { AssistantRpcLive } from "@/AssistantRpcLive.js";
import { layerScripted } from "@/Model.js";
import { describe, expect, it } from "@effect/vitest";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { AgentModule } from "@vantion/module-agent/Module";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer, Stream } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

const identity = (org: string) =>
  new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role: "owner",
    permissions: Array.from(permissionsFor("owner")),
  });

const as = (org: string) =>
  AssistantRpcLive.pipe(
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(CurrentUser, identity(org)),
            Effect.provideService(CurrentEntitlement, free),
          )
        ),
      ),
    ),
    // The scripted model, which is the point: what is under test is the loop,
    // the approval gate and the record kept of both — none of which a real
    // model would test more truthfully, only less repeatably.
    Layer.provideMerge(layerScripted),
    Layer.provideMerge(AgentModule),
    Layer.provideMerge(ContactStore.layer),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

const seed = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
  yield* sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
             values (${`user_${org}`}, ${org}, ${`${org}@example.com`}, true, now(), now())
             on conflict ("id") do nothing`;
});

const chunks = (stream: Stream.Stream<Chunk, unknown>) => Stream.runCollect(stream);

describe.skipIf(testDbUrl() === undefined)("the assistant", () => {
  it.layer(as("chat_a"))("a turn", (it) => {
    it.effect("answers, and keeps the conversation", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AssistantRpcs);

        yield* seed("chat_a");

        const conversation = yield* client.StartConversation();
        const said = yield* chunks(
          client.SendMessage({ conversationId: conversation.id, text: "hello there" }),
        );

        expect(said.filter((chunk) => chunk._tag === "Text").map((chunk) => chunk.text).join(""))
          .toContain("scripted stand-in");

        // The product's own record, which is what the screen renders — the
        // provider's history is a cache beside it.
        const messages = yield* client.GetMessages({ conversationId: conversation.id });
        expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);

        // And the first thing said names the conversation.
        const listed = yield* client.ListConversations();
        expect(listed[0]?.title).toBe("hello there");
      }));

    it.effect("uses a tool when the question needs one", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AssistantRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seed("chat_a");
        yield* sql`insert into "contact" ("id", "organizationId", "email", "fullName")
                   values ('chat_a_ada', 'chat_a', 'ada@example.com', 'Ada')
                   on conflict ("id") do nothing`;

        const conversation = yield* client.StartConversation();
        const said = yield* chunks(
          client.SendMessage({ conversationId: conversation.id, text: "list my contacts" }),
        );

        expect(said.filter((chunk) => chunk._tag === "Tool").map((chunk) => chunk.name))
          .toEqual(["ListContacts"]);

        const messages = yield* client.GetMessages({ conversationId: conversation.id });
        expect(messages.map((message) => message.toolName)).toContain("ListContacts");
      }));
  });

  it.layer(as("chat_approval"))("a write", (it) => {
    /**
     * The gate, end to end. The model asks to create a contact, the turn stops
     * with a request rather than a row, and nothing exists until a person says
     * yes — which is the difference between an assistant that can act and one
     * that acts on its own.
     */
    it.effect("waits to be approved, and only then happens", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AssistantRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seed("chat_approval");

        const conversation = yield* client.StartConversation();
        const asked = yield* chunks(
          client.SendMessage({
            conversationId: conversation.id,
            text: "add contact grace@navy.test",
          }),
        );

        const approval = asked.find((chunk) => chunk._tag === "Approval");
        expect(approval).toBeDefined();
        expect(approval).toMatchObject({ tool: "CreateContact" });
        // The summary is what a person actually reads before agreeing, so it
        // has to name the arguments rather than only the tool.
        expect(approval?._tag === "Approval" ? approval.summary : "").toContain("grace@navy.test");

        const before = yield* sql`
          select 1 from "contact" where "organizationId" = 'chat_approval'
        `;
        expect(before, "the contact was created before anybody approved it").toHaveLength(0);

        yield* chunks(
          client.Approve({
            conversationId: conversation.id,
            approvalId: approval?._tag === "Approval" ? approval.approvalId : "",
            approved: true,
          }),
        );

        const after = yield* sql<{ email: string; }>`
          select "email" from "contact" where "organizationId" = 'chat_approval'
        `;
        expect(after.map((row) => row.email)).toEqual(["grace@navy.test"]);
      }));

    it.effect("does nothing when it is declined", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AssistantRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seed("chat_approval");

        const conversation = yield* client.StartConversation();
        const asked = yield* chunks(
          client.SendMessage({
            conversationId: conversation.id,
            text: "add contact declined@navy.test",
          }),
        );
        const approval = asked.find((chunk) => chunk._tag === "Approval");

        yield* chunks(
          client.Approve({
            conversationId: conversation.id,
            approvalId: approval?._tag === "Approval" ? approval.approvalId : "",
            approved: false,
          }),
        );

        const rows = yield* sql`
          select 1 from "contact" where "email" = 'declined@navy.test'
        `;
        expect(rows).toHaveLength(0);
      }));
  });

  it.layer(as("chat_tenant"))("another tenant's conversation", (it) => {
    it.effect("cannot be read or continued by naming its id", () =>
      Effect.gen(function*() {
        const client = yield* RpcTest.makeClient(AssistantRpcs);
        const sql = yield* SqlClient.SqlClient;

        yield* seed("chat_tenant");
        yield* seed("chat_other");
        yield* sql`
          insert into "conversation" ("id", "organizationId", "userId", "title")
          values ('theirs', 'chat_other', 'user_chat_other', 'Theirs')
          on conflict ("id") do nothing
        `;

        expect(yield* client.ListConversations()).toHaveLength(0);

        expect(yield* Effect.flip(client.GetMessages({ conversationId: "theirs" as never })))
          .toMatchObject({ _tag: "ConversationNotFound" });

        expect(
          yield* Effect.flip(
            Stream.runCollect(
              client.SendMessage({ conversationId: "theirs" as never, text: "who is in here?" }),
            ),
          ),
        ).toMatchObject({ _tag: "ConversationNotFound" });
      }));
  });
});
