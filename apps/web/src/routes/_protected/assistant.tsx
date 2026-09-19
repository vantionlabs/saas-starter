import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import type { Ask } from "@vantion/core/atoms/Assistant";
import {
  conversationsAtom,
  messagesAtom,
  sendAtom,
  startConversationAtom,
} from "@vantion/core/atoms/Assistant";
import type { Chunk, ConversationId } from "@vantion/module-assistant/AssistantRpc";
import { QueryError } from "@vantion/ui/app/query-error";
import { Conversation, emptyTurn, type Turn } from "@vantion/ui/assistant/conversation";
import { PromptBar } from "@vantion/ui/assistant/prompt-bar";
import { Skeleton } from "@vantion/ui/ui/skeleton";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import * as React from "react";
import { toast } from "sonner";

/** Folds one chunk into what the screen is showing. */
const fold = (turn: Turn, chunk: Chunk): Turn => {
  if (chunk._tag === "Text") return { ...turn, text: turn.text + chunk.text };
  if (chunk._tag === "Tool") {
    return {
      ...turn,
      tools: [...turn.tools, { name: chunk.name, refused: chunk.refused ?? undefined }],
    };
  }

  return {
    ...turn,
    approval: { approvalId: chunk.approvalId, tool: chunk.tool, summary: chunk.summary },
  };
};

const Assistant = () => {
  const conversations = useAtomValue(conversationsAtom);
  const start = useAtomSet(startConversationAtom, { mode: "promiseExit" });
  const send = useAtomSet(sendAtom, { mode: "promiseExit" });
  const [active, setActive] = React.useState<ConversationId | undefined>(undefined);
  const [turn, setTurn] = React.useState<Turn>(emptyTurn);

  /**
   * The page opens on the most recent conversation rather than an empty one.
   *
   * Coming back to a half-finished thread is the ordinary case — and it is the
   * only way a pending approval survives somebody opening another page to
   * check something before they answer it.
   */
  const latest = AsyncResult.isSuccess(conversations) ? conversations.value[0]?.id : undefined;
  const current = active ?? latest;

  const thread = useAtomValue(messagesAtom(current ?? ""));
  const refreshMessages = useAtomRefresh(messagesAtom(current ?? ""));

  /**
   * A conversation that was left mid-approval comes back still asking.
   *
   * The request lives in the stored conversation, so reopening the page picks
   * it up rather than losing the decision somebody was in the middle of.
   */
  const stored = AsyncResult.isSuccess(thread) ? thread.value : undefined;
  const pending = stored?.pendingApproval ?? undefined;

  React.useEffect(() => {
    if (pending === undefined) return;

    setTurn((current) =>
      current.approval === undefined
        ? { ...emptyTurn, approval: pending }
        : current
    );
  }, [pending]);

  /**
   * The live turn is cleared only once the recorded messages have been
   * re-read, so the answer does not blink out and back in between the stream
   * ending and the list refreshing.
   */
  const run = React.useCallback(
    async (descriptor: Ask) => {
      setTurn({ ...emptyTurn, streaming: true });

      const result = await send({
        send: descriptor,
        onChunk: (chunk) => setTurn((current) => fold(current, chunk)),
      });

      setTurn((current) => ({ ...current, streaming: false }));

      if (!Exit.isSuccess(result)) {
        toast.error("The assistant could not answer. Nothing was changed.");
      }
    },
    [send],
  );

  /**
   * Clears the live turn once its messages have been re-read — unless it
   * stopped to ask.
   *
   * A turn ending is not the same as a turn finishing. When the model proposes
   * a write, the stream completes and the approval is what remains: clearing
   * it here made the card appear and vanish in the same frame, which is how
   * the first version of this passed every unit test and did nothing in a
   * browser.
   */
  const settle = React.useCallback(() => {
    setTurn((current) =>
      current.approval === undefined ? emptyTurn : { ...current, streaming: false }
    );
  }, []);

  const onSend = React.useCallback(async (text: string) => {
    let conversationId = current;

    if (conversationId === undefined) {
      const created = await start();

      if (!Exit.isSuccess(created)) {
        toast.error("Could not start a conversation.");
        return;
      }

      conversationId = created.value.id;
      setActive(conversationId);
    }

    await run({ kind: "message", conversationId, text });
    refreshMessages();
    settle();
  }, [current, refreshMessages, run, settle, start]);

  const onDecide = React.useCallback(async (approved: boolean) => {
    const approval = turn.approval;

    if (approval === undefined || current === undefined) return;

    // The decision is shown on the card straight away; the rest of the turn
    // follows it.
    setTurn((current) => ({ ...current, decided: approved ? "approved" : "declined" }));

    await run({
      kind: "approval",
      conversationId: current,
      approvalId: approval.approvalId,
      approved,
    });
    refreshMessages();
    settle();
  }, [current, refreshMessages, run, settle, turn.approval]);

  if (AsyncResult.isFailure(conversations)) {
    return <QueryError result={conversations} subject="the assistant" />;
  }

  if (!AsyncResult.isSuccess(conversations)) return <Skeleton className="h-96 w-full" />;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Assistant</h1>
        <p className="text-muted-foreground text-sm">
          Reads your organization&apos;s data through your own permissions, and asks before it
          writes
        </p>
      </div>

      <Conversation
        messages={current === undefined ? [] : stored?.messages ?? []}
        turn={turn}
        onDecide={(approved) => void onDecide(approved)}
        composer={<PromptBar busy={turn.streaming} onSend={(text) => void onSend(text)} />}
      />
    </section>
  );
};

export const Route = createFileRoute("/_protected/assistant")({
  staticData: { crumb: "Assistant" },
  component: Assistant,
});
