import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { Forbidden } from "@vantion/module-iam/identity/Policy";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const ConversationId = Schema.String.pipe(Schema.brand("ConversationId")).annotate({
  identifier: "ConversationId",
});
export type ConversationId = typeof ConversationId.Type;

export class Conversation extends Schema.Class<Conversation>("Conversation")({
  id: ConversationId,
  title: Schema.String,
  updatedAt: Schema.String,
}) {}

export class Message extends Schema.Class<Message>("Message")({
  id: Schema.String,
  role: Schema.Literals(["user", "assistant", "tool"]),
  text: Schema.String,
  toolName: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
}) {}

/**
 * What a turn produces, narrowed to what a screen can render.
 *
 * Deliberately not the library's own response parts. Those carry provider
 * metadata, token accounting and half a dozen part types this product has no
 * opinion about — passing them through would make the front end depend on a
 * model vendor's schema, which is exactly what the port exists to prevent.
 */
export const Chunk = Schema.Union([
  Schema.TaggedStruct("Text", { text: Schema.String }),
  /** The assistant used a tool. Named, so the screen can say which. */
  Schema.TaggedStruct("Tool", { name: Schema.String }),
  /**
   * The assistant wants to do something that writes, and is asking first.
   *
   * The turn stops here. Nothing is executed until `Approve` says so, which is
   * the whole point: a model that misreads an instruction is acting entirely
   * within its permissions while doing the wrong thing.
   */
  Schema.TaggedStruct("Approval", {
    approvalId: Schema.String,
    tool: Schema.String,
    /** The arguments it proposes, as text a person can actually check. */
    summary: Schema.String,
  }),
]);
export type Chunk = typeof Chunk.Type;

/**
 * The assistant cannot answer, and why.
 *
 * Two reasons, kept apart because they need different words on screen and
 * different actions from whoever reads them: `NotConfigured` is a deployment
 * that has never had a key, and `ProviderFailed` is a model that was there a
 * minute ago. Collapsing them would have somebody checking their configuration
 * over a provider outage.
 */
export class AssistantUnavailable
  extends Schema.TaggedError<AssistantUnavailable>()("AssistantUnavailable", {
    reason: Schema.Literals(["NotConfigured", "ProviderFailed"]),
  })
{}

export class ConversationNotFound
  extends Schema.TaggedError<ConversationNotFound>()("ConversationNotFound", {})
{}

const turnError = Schema.Union([Forbidden, AssistantUnavailable, ConversationNotFound]);

export const AssistantRpcs = RpcGroup.make(
  Rpc.make("ListConversations", { success: Schema.Array(Conversation), error: Forbidden }),
  Rpc.make("StartConversation", { success: Conversation, error: Forbidden }),
  Rpc.make("GetMessages", {
    payload: { conversationId: ConversationId },
    success: Schema.Array(Message),
    error: Schema.Union([Forbidden, ConversationNotFound]),
  }),
  /**
   * A turn, streamed.
   *
   * Streaming rather than a single response because the first token is what
   * tells somebody the thing is working, and a tool call can take seconds. The
   * transport is the one `Health.Watch` already uses.
   */
  Rpc.make("SendMessage", {
    payload: {
      conversationId: ConversationId,
      text: Schema.String.check(Schema.isNonEmpty()),
    },
    success: Chunk,
    error: turnError,
    stream: true,
  }),
  /** Answers an approval request, and continues the turn either way. */
  Rpc.make("Approve", {
    payload: {
      conversationId: ConversationId,
      approvalId: Schema.String,
      approved: Schema.Boolean,
    },
    success: Chunk,
    error: turnError,
    stream: true,
  }),
).middleware(AuthMiddleware);
