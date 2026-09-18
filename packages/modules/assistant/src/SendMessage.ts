import { Effect, Stream } from "effect";
import { AssistantRpcs, AssistantUnavailable } from "./AssistantRpc.js";
import { openChat } from "./Chat.js";
import { appendMessage, setTitle, titleFrom } from "./Conversations.js";
import { ModelStatus } from "./Model.js";
import { runTurn } from "./Turn.js";

/**
 * A turn, streamed.
 *
 * The refusal comes first and is checked before anything is written: a
 * deployment with no model should not accumulate conversations of unanswered
 * questions.
 */
export const SendMessage = AssistantRpcs.toLayerHandler("SendMessage", (payload) =>
  Stream.unwrap(
    Effect.gen(function*() {
      const status = yield* ModelStatus;

      if (!status.configured) return yield* new AssistantUnavailable({ reason: "NotConfigured" });

      const chat = yield* openChat(payload.conversationId);

      yield* appendMessage({
        conversationId: payload.conversationId,
        role: "user",
        text: payload.text,
      });
      // Only the first message names the conversation; the update is a no-op
      // once it has a title.
      yield* setTitle(payload.conversationId, titleFrom(payload.text));

      return runTurn({ conversationId: payload.conversationId, chat, say: payload.text });
    }),
  ));
