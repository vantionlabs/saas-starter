import { usePersona } from "@/screens/persona.js";
import { Conversation } from "@vantion/ui/assistant/conversation";
import { PromptBar } from "@vantion/ui/assistant/prompt-bar";

/**
 * The assistant, in the state a designer can least easily reach.
 *
 * Seeing a pending approval in the real product means asking a model to write
 * something and catching it mid-turn. Here it is a fixture, so the card can be
 * looked at, argued about and changed without a key, a bill or a stopwatch.
 */
export const Assistant = () => {
  const persona = usePersona();

  return (
    <div className="h-[70vh]">
      <Conversation
        messages={persona.conversation}
        turn={{
          text: "",
          tools: [{ name: "SearchContacts" }, { name: "ListFiles", refused: "file:read" }],
          approval: {
            approvalId: "approval-fixture",
            tool: "CreateContact",
            summary: "CreateContact — email: grace@navy.test, fullName: Grace Hopper",
          },
          decided: undefined,
          streaming: false,
        }}
        onDecide={() => {}}
        composer={<PromptBar busy={false} onSend={() => {}} />}
      />
    </div>
  );
};
