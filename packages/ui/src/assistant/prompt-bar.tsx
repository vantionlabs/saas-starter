import { ArrowUp } from "lucide-react";
import * as React from "react";

/*
 * The composer.
 *
 * Beautiful UI ships a Prompt Bar with @-sources, /-commands, a model picker
 * and dictation, on a dependency of its own. None of those exist behind this
 * assistant — there is one model, no command palette for it and no source
 * picker — so this is written in the same visual language rather than vendored
 * with four controls that would do nothing. Its proportions, radii and the
 * enclosed send button are taken from that original.
 */

export const PromptBar = (props: {
  readonly busy: boolean;
  readonly placeholder?: string;
  readonly onSend: (text: string) => void;
}) => {
  const [text, setText] = React.useState("");

  const send = React.useCallback(() => {
    const trimmed = text.trim();

    if (trimmed === "" || props.busy) return;

    setText("");
    props.onSend(trimmed);
  }, [props, text]);

  return (
    <div className="flex items-end gap-2 rounded-card bg-surface p-2 shadow-card">
      <textarea
        value={text}
        rows={1}
        aria-label="Message the assistant"
        placeholder={props.placeholder ?? "Ask about your contacts and files…"}
        className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, shift+enter breaks the line: the convention every
          // chat surface has, and the one people's hands already know.
          if (event.key !== "Enter" || event.shiftKey) return;

          event.preventDefault();
          send();
        }}
      />
      <button
        type="button"
        aria-label="Send"
        disabled={props.busy || text.trim() === ""}
        onClick={send}
        className="primitive-icon-button bg-accent text-[color:var(--primary-foreground)] transition-opacity duration-150 disabled:opacity-40"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
    </div>
  );
};
