import { Effect, Stream } from "effect";
import { Prompt } from "effect/unstable/ai";
import { AssistantRpcs, AssistantUnavailable } from "./AssistantRpc.js";
import { openChat } from "./Chat.js";
import { appendMessage } from "./Conversations.js";
import { ModelStatus } from "./Model.js";
import { runTurn } from "./Turn.js";

/**
 * The answer to "may I?", and the rest of the turn either way.
 *
 * A denial is not an error and not silence: the response goes into the history
 * as a refusal the model can see, so it says what it did not do instead of
 * pretending the request never happened or trying a different route to the same
 * write.
 *
 * What is recorded here is the *decision*, in the product's own message log,
 * because "who approved this" is the question somebody asks afterwards and the
 * provider's history is a cache rather than a record.
 */
export const Approve = AssistantRpcs.toLayerHandler("Approve", (payload) =>
  Stream.unwrap(
    Effect.gen(function*() {
      const status = yield* ModelStatus;

      if (!status.configured) return yield* new AssistantUnavailable({ reason: "NotConfigured" });

      const chat = yield* openChat(payload.conversationId);

      yield* appendMessage({
        conversationId: payload.conversationId,
        role: "user",
        text: payload.approved ? "Approved." : "Declined.",
      });

      return runTurn({
        conversationId: payload.conversationId,
        chat,
        say: [
          Prompt.toolMessage({
            content: [
              Prompt.toolApprovalResponsePart({
                approvalId: payload.approvalId,
                approved: payload.approved,
              }),
            ],
          }),
        ],
      });
    }),
  ));
