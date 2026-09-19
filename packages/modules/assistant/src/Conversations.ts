import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { Effect, Option, Schema } from "effect";
import { Prompt } from "effect/unstable/ai";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import {
  Conversation,
  ConversationId,
  ConversationNotFound,
  Message,
  Thread,
} from "./AssistantRpc.js";
import { pendingApproval } from "./Pending.js";

/**
 * The stored prompt, decoded through the library's own schema.
 *
 * Going through the schema rather than casting is what makes the column safe to
 * read back after an upgrade: a shape the current version cannot parse fails
 * here, loudly, instead of reaching a provider as nonsense.
 */
const StoredPrompt = Schema.Array(Prompt.Message);

export const listConversations = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId, userId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<{ id: string; title: string; updatedAt: Date; }>`
    select "id", "title", "updatedAt" from "conversation"
    where "organizationId" = ${orgId} and "userId" = ${userId}
    order by "updatedAt" desc
    limit 50
  `).pipe(Effect.orDie);

  return rows.map((row) =>
    new Conversation({
      id: ConversationId.make(row.id),
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    })
  );
});

export const startConversation = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId, userId } = yield* CurrentUser;
  const id = ConversationId.make(randomUUID());

  const rows = yield* withOrgScope(sql<{ updatedAt: Date; }>`
    insert into "conversation" ("id", "organizationId", "userId")
    values (${id}, ${orgId}, ${userId})
    returning "updatedAt"
  `).pipe(Effect.orDie);

  return new Conversation({
    id,
    title: "New conversation",
    updatedAt: (rows[0]?.updatedAt ?? new Date()).toISOString(),
  });
});

/**
 * One conversation's stored prompt, if it belongs to the caller.
 *
 * Scoped to the *user* as well as the organization: the tools run as whoever is
 * asking, so one member reading another's thread would be reading the results
 * of permissions they may not have.
 */
export const loadState = (id: ConversationId) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId, userId } = yield* CurrentUser;

    const rows = yield* withOrgScope(sql<{ state: unknown; }>`
      select "state" from "conversation"
      where "id" = ${id} and "organizationId" = ${orgId} and "userId" = ${userId}
    `).pipe(Effect.orDie);

    const row = rows[0];

    if (row === undefined) return Option.none();

    return Option.some(
      yield* Schema.decodeUnknownEffect(StoredPrompt)(row.state).pipe(Effect.orDie),
    );
  });

export const saveState = (id: ConversationId, prompt: Prompt.Prompt) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    const encoded = yield* Schema.encodeEffect(StoredPrompt)(prompt.content).pipe(Effect.orDie);

    yield* withOrgScope(sql`
      update "conversation"
      set "state" = ${JSON.stringify(encoded)}::jsonb, "updatedAt" = now()
      where "id" = ${id} and "organizationId" = ${orgId}
    `).pipe(Effect.orDie);
  });

/** The product's own record of the turn, which is what the screen renders. */
export const appendMessage = (options: {
  readonly conversationId: ConversationId;
  readonly role: "user" | "assistant" | "tool";
  readonly text: string;
  readonly toolName?: string | undefined;
}) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    yield* withOrgScope(sql`
      insert into "message" ("id", "conversationId", "organizationId", "role", "text", "toolName")
      values (
        ${randomUUID()}, ${options.conversationId}, ${orgId},
        ${options.role}, ${options.text}, ${options.toolName ?? null}
      )
    `).pipe(Effect.orDie);
  });

/** The first thing somebody said, as the conversation's name. */
export const titleFrom = (text: string) =>
  text.length <= 60 ? text : `${text.slice(0, 57).trimEnd()}…`;

export const setTitle = (id: ConversationId, title: string) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    yield* withOrgScope(sql`
      update "conversation" set "title" = ${title}
      where "id" = ${id} and "organizationId" = ${orgId} and "title" = 'New conversation'
    `).pipe(Effect.orDie);
  });

/**
 * The turns in one conversation.
 *
 * An unknown id and somebody else's are the same answer — `ConversationNotFound`
 * — because they are the same fact from the caller's side, and telling them
 * apart would confirm that an id exists. Returning an empty list instead would
 * leave a screen rendering a thread that will never have anything in it.
 */
export const listMessages = (id: ConversationId) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId, userId } = yield* CurrentUser;

    const conversation = yield* withOrgScope(sql`
      select 1 from "conversation"
      where "id" = ${id} and "organizationId" = ${orgId} and "userId" = ${userId}
    `).pipe(Effect.orDie);

    if (conversation.length === 0) return yield* new ConversationNotFound();

    const rows = yield* withOrgScope(sql<{
      id: string;
      role: "user" | "assistant" | "tool";
      text: string;
      toolName: string | null;
      createdAt: Date;
    }>`
      select m."id", m."role", m."text", m."toolName", m."createdAt"
      from "message" m
      join "conversation" c on c."id" = m."conversationId"
      where m."conversationId" = ${id}
        and m."organizationId" = ${orgId}
        and c."userId" = ${userId}
      order by m."createdAt"
    `).pipe(Effect.orDie);

    const stored = yield* loadState(id);

    return new Thread({
      messages: rows.map((row) =>
        new Message({
          id: row.id,
          role: row.role,
          text: row.text,
          toolName: row.toolName,
          createdAt: row.createdAt.toISOString(),
        })
      ),
      pendingApproval: Option.match(stored, {
        onNone: () => null,
        onSome: (prompt) => pendingApproval(prompt),
      }),
    });
  });
