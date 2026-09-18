import { Effect, Option } from "effect";
import { Chat, Prompt } from "effect/unstable/ai";
import type { ConversationId } from "./AssistantRpc.js";
import { ConversationNotFound } from "./AssistantRpc.js";
import { loadState } from "./Conversations.js";
import { SYSTEM } from "./Turn.js";

/**
 * The conversation, reopened.
 *
 * A chat is built from what was stored rather than kept in memory between
 * requests: the process that answers the next message is not necessarily the
 * one that answered the last, and a conversation that only worked while one
 * server stayed up would be a conversation that breaks on every deploy.
 */
export const openChat = (conversationId: ConversationId) =>
  Effect.gen(function*() {
    const stored = yield* loadState(conversationId);

    if (Option.isNone(stored)) return yield* new ConversationNotFound();

    const history = stored.value.length === 0
      ? [Prompt.systemMessage({ content: SYSTEM })]
      : stored.value;

    return yield* Chat.fromPrompt(history);
  });
