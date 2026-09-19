import type { Message } from "@vantion/module-assistant/AssistantRpc";
import * as React from "react";
import { Answer, Working } from "./answer.js";
import { ApprovalCard } from "./approval-card.js";
import { ToolChips } from "./tool-chip.js";

/** What is happening right now, as distinct from what is already recorded. */
export type Turn = {
  readonly text: string;
  readonly tools: ReadonlyArray<string>;
  readonly approval:
    | { readonly approvalId: string; readonly tool: string; readonly summary: string; }
    | undefined;
  readonly decided: "approved" | "declined" | undefined;
  readonly streaming: boolean;
};

export const emptyTurn: Turn = {
  text: "",
  tools: [],
  approval: undefined,
  decided: undefined,
  streaming: false,
};

const Bubble = (props: { readonly children: React.ReactNode; }) => (
  <div
    className="ml-auto max-w-[80%] rounded-card bg-inset px-3 py-2 text-[14px] text-ink shadow-hairline"
    style={{ animation: "fade-up 260ms cubic-bezier(0.23,1,0.32,1) both" }}
  >
    {props.children}
  </div>
);

/**
 * The conversation, composed from the adapted Beautiful UI primitives.
 *
 * `.bui` is not decoration: the bridge stylesheet defines that library's token
 * names inside this class, in our palette. Render these components outside it
 * and `--accent` means something else entirely.
 *
 * Entirely prop-driven, like every other component in this package, so
 * `apps/design` can render a conversation mid-approval without a model, a key
 * or a network.
 */
export const Conversation = (props: {
  readonly messages: ReadonlyArray<Message>;
  readonly turn: Turn;
  readonly composer: React.ReactNode;
  readonly onDecide: (approved: boolean) => void;
}) => {
  const bottom = React.useRef<HTMLDivElement>(null);

  // Follows the answer as it arrives, and only then: a jump on every render
  // would fight somebody scrolling back through what was said.
  React.useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [props.messages.length, props.turn.text, props.turn.approval]);

  return (
    <div className="bui flex h-full min-h-0 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {props.messages.length === 0 && props.turn.text === "" && (
          <div className="text-[13px] text-ink-2">
            Ask about this organization&apos;s contacts and files. The assistant reads through the
            same permissions you have, and asks before it writes anything.
          </div>
        )}

        {props.messages.map((message) =>
          message.role === "user"
            ? <Bubble key={message.id}>{message.text}</Bubble>
            : message.role === "tool"
            ? <ToolChips key={message.id} names={[message.toolName ?? message.text]} />
            : <Answer key={message.id} text={message.text} />
        )}

        {props.turn.tools.length > 0 && <ToolChips names={props.turn.tools} />}

        {props.turn.text !== "" && (
          <Answer text={props.turn.text} streaming={props.turn.streaming} />
        )}

        {props.turn.streaming && props.turn.text === "" && props.turn.approval === undefined && (
          <Working label={props.turn.tools.length === 0 ? "Thinking" : "Reading your data"} />
        )}

        {props.turn.approval !== undefined && (
          <ApprovalCard
            tool={props.turn.approval.tool}
            summary={props.turn.approval.summary}
            busy={props.turn.streaming}
            decided={props.turn.decided}
            onDecide={props.onDecide}
          />
        )}

        <div ref={bottom} />
      </div>

      {props.composer}
    </div>
  );
};
