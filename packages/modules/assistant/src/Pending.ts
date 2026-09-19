import type { Prompt } from "effect/unstable/ai";

/**
 * The approval this conversation is still waiting on, if any.
 *
 * Read out of the stored prompt rather than remembered by whoever asked: the
 * request was written into the history when the turn stopped, and the response
 * is written there when somebody answers. What is pending is therefore a
 * request with no response — which is a fact about the conversation, not about
 * the browser tab that happened to be open.
 *
 * The tool call is matched back by id so the summary can name what is actually
 * proposed. An approval request carries only two ids; the arguments a person
 * needs to see are on the call beside it.
 */
export const pendingApproval = (messages: ReadonlyArray<Prompt.Message>) => {
  const answered = new Set<string>();
  const calls = new Map<string, { readonly name: string; readonly params: unknown; }>();
  let waiting: { readonly approvalId: string; readonly toolCallId: string; } | undefined;

  for (const message of messages) {
    if (message.role === "assistant") {
      for (const part of message.content) {
        if (part.type === "tool-call") {
          calls.set(part.id, { name: part.name, params: part.params });
        }

        if (part.type === "tool-approval-request") {
          waiting = { approvalId: part.approvalId, toolCallId: part.toolCallId };
        }
      }
    }

    if (message.role === "tool") {
      for (const part of message.content) {
        if (part.type === "tool-approval-response") answered.add(part.approvalId);
      }
    }
  }

  if (waiting === undefined || answered.has(waiting.approvalId)) return null;

  const call = calls.get(waiting.toolCallId);

  return {
    approvalId: waiting.approvalId,
    tool: call?.name ?? "a tool",
    summary: call === undefined ? "a tool" : describe(call.name, call.params),
  };
};

/** The same rendering the turn uses, so a reloaded card reads identically. */
export const describe = (name: string, params: unknown): string => {
  const rendered = typeof params === "object" && params !== null
    ? Object.entries(params as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ")
    : String(params);

  return rendered === "" ? name : `${name} — ${rendered}`;
};
