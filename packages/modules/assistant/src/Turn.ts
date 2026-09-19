import { AgentToolkit } from "@vantion/module-agent/Module";
import { Effect, Ref, Result, Stream } from "effect";
import { Chat, type Prompt } from "effect/unstable/ai";
import type { Chunk, ConversationId } from "./AssistantRpc.js";
import { AssistantUnavailable } from "./AssistantRpc.js";
import { appendMessage, saveState } from "./Conversations.js";
import { describe } from "./Pending.js";

/**
 * How the assistant is told what it is.
 *
 * Short on purpose. Everything it may do is in the tools, and every refusal is
 * enforced by a policy rather than by this paragraph — a system prompt that
 * lists rules the code does not enforce is a rule nobody enforces.
 *
 * It is a message at the head of the conversation rather than an option on each
 * call, because that is where the library keeps it: the history is the whole
 * input, and a system prompt supplied per turn would be a second place for the
 * same thing to live.
 */
export const SYSTEM = `You are an assistant inside a business application.

Answer from the tools rather than from memory: the data belongs to one
organization and only the tools can see it. If a tool refuses, say which
permission was missing and stop — do not try another way round.

Before anything that writes, state plainly what you are about to do. The person
will be asked to approve it.`;

/**
 * One turn, as chunks a screen can render.
 *
 * `Chat` runs the loop and owns the history: it calls the model, executes the
 * tools it asks for, feeds the results back and asks again until the model
 * stops. What this adds is the translation into our own narrow parts, the
 * product's record of what happened, and the stopping point — a tool marked
 * `needsApproval` emits a request instead of running, and the turn ends there
 * with the history saved so the next call can continue it.
 */
export const runTurn = (options: {
  readonly conversationId: ConversationId;
  readonly chat: Chat.Service;
  readonly say: Prompt.RawInput;
}) =>
  Stream.suspend(() => {
    /**
     * Collected as the stream goes and written when it ends.
     *
     * A turn that failed halfway leaves no assistant message rather than half
     * of one: what the model said before an error is not an answer, and
     * storing it would put words in its mouth it never finished saying.
     */
    let text = "";
    const tools: Array<string> = [];
    /** Tool calls by id, because an approval request names only the id. */
    const calls = new Map<string, { readonly name: string; readonly params: unknown; }>();

    return options.chat.streamText({
      prompt: options.say,
      toolkit: AgentToolkit,
    }).pipe(
      Stream.filterMap((part) => {
        if (part.type === "text-delta") {
          text += part.delta;

          return Result.succeed<Chunk>({ _tag: "Text", text: part.delta });
        }

        if (part.type === "tool-call") {
          tools.push(part.name);
          calls.set(part.id, { name: part.name, params: part.params });

          return Result.succeed<Chunk>({ _tag: "Tool", name: part.name });
        }

        if (part.type === "tool-approval-request") {
          const call = calls.get(part.toolCallId);

          return Result.succeed<Chunk>({
            _tag: "Approval",
            approvalId: part.approvalId,
            tool: call?.name ?? "a tool",
            summary: call === undefined ? "a tool" : describe(call.name, call.params),
          });
        }

        return Result.fail(part);
      }),
      /**
       * A provider that is unreachable, over quota or misconfigured all arrive
       * as one `AiError`. The contract says so in the caller's vocabulary
       * rather than exporting the library's error to every client.
       */
      Stream.catchTag("AiError", (error) =>
        Stream.fromEffect(
          Effect.andThen(
            Effect.logError("the assistant's provider failed", error),
            new AssistantUnavailable({ reason: "ProviderFailed" }),
          ),
        )),
      Stream.onEnd(
        Effect.gen(function*() {
          yield* saveState(options.conversationId, yield* Ref.get(options.chat.history));

          for (const tool of tools) {
            yield* appendMessage({
              conversationId: options.conversationId,
              role: "tool",
              text: tool,
              toolName: tool,
            });
          }

          if (text.trim() !== "") {
            yield* appendMessage({
              conversationId: options.conversationId,
              role: "assistant",
              text,
            });
          }
        }),
      ),
    );
  });
