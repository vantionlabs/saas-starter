import { ArrowUp } from "lucide-react";
import * as React from "react";
import { useHydrated } from "../lib/use-hydrated.js";

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

/**
 * Uncontrolled, because the page it sits on is rendered by the server.
 *
 * The textarea held its value in React state and the send button was disabled
 * while that state was empty. Both are true before React attaches, so anything
 * typed in that window went into the DOM, never reached the component, and left
 * the button dead forever — silently. The DOM holds the text now, `send` reads
 * it, and nothing here needs to re-render as somebody types.
 *
 * The button is disabled only while a turn is in flight or React is not
 * listening yet. Empty input is refused by `send` rather than by greying the
 * control, which is the same trade `ContactForm` makes: a control that is dead
 * for a reason it will not state is the harder one to use.
 */
export const PromptBar = (props: {
  readonly busy: boolean;
  readonly placeholder?: string;
  readonly onSend: (text: string) => void;
}) => {
  const hydrated = useHydrated();
  const input = React.useRef<HTMLTextAreaElement>(null);

  const send = React.useCallback(() => {
    const trimmed = input.current?.value.trim() ?? "";

    if (trimmed === "" || props.busy) return;

    if (input.current !== null) input.current.value = "";
    props.onSend(trimmed);
  }, [props]);

  return (
    <div className="flex items-end gap-2 rounded-card bg-surface p-2 shadow-card">
      <textarea
        ref={input}
        rows={1}
        aria-label="Message the assistant"
        placeholder={props.placeholder ?? "Ask about your contacts and files…"}
        className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3"
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
        disabled={props.busy || !hydrated}
        onClick={send}
        className="primitive-icon-button bg-accent text-[color:var(--primary-foreground)] transition-opacity duration-150 disabled:opacity-40"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
    </div>
  );
};
