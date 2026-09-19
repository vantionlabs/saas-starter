import type { Chunk } from "@vantion/module-assistant/AssistantRpc";
import { ConversationId, Thread } from "@vantion/module-assistant/AssistantRpc";
import { Effect, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { AppRpc } from "./AppRpc.js";
import { Keys } from "./Keys.js";

export const conversationsAtom = Atom.withReactivity([Keys.organization, Keys.assistant])(
  AppRpc.runtime.atom(
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("ListConversations", undefined);
    }),
  ),
);

export const startConversationAtom = AppRpc.runtime.fn<void>()(
  () =>
    Effect.gen(function*() {
      const client = yield* AppRpc;

      return yield* client("StartConversation", undefined);
    }),
  { reactivityKeys: [Keys.assistant] },
);

/**
 * Keyed by a plain string, and empty for an empty one.
 *
 * A hook cannot be called conditionally, so the page asks for this atom before
 * it knows which conversation it is showing. The alternative — a branded id
 * cast from `""` — is the thing `RULES.md` forbids and the hook catches: a
 * brand that was never validated is a brand that means nothing.
 */
export const messagesAtom = Atom.family((conversationId: string) =>
  Atom.withReactivity([Keys.assistant])(
    AppRpc.runtime.atom(
      Effect.gen(function*() {
        if (conversationId === "") {
          return new Thread({ messages: [], pendingApproval: null });
        }

        const client = yield* AppRpc;

        return yield* client("GetMessages", {
          conversationId: ConversationId.make(conversationId),
        });
      }),
    ),
  )
);

/**
 * A turn, consumed chunk by chunk.
 *
 * `runForEach` rather than an atom holding the stream: the page renders the
 * partial answer as it arrives, so what it needs is a callback per chunk and a
 * promise for the end — not a value it can subscribe to once.
 */
export type Ask =
  | { readonly kind: "message"; readonly conversationId: ConversationId; readonly text: string; }
  | {
    readonly kind: "approval";
    readonly conversationId: ConversationId;
    readonly approvalId: string;
    readonly approved: boolean;
  };

export const turn = (options: {
  readonly send: Ask;
  readonly onChunk: (chunk: Chunk) => void;
}) =>
  Effect.gen(function*() {
    const client = yield* AppRpc;

    const stream = options.send.kind === "message"
      ? client("SendMessage", {
        conversationId: options.send.conversationId,
        text: options.send.text,
      })
      : client("Approve", {
        conversationId: options.send.conversationId,
        approvalId: options.send.approvalId,
        approved: options.send.approved,
      });

    yield* Stream.runForEach(stream, (chunk) => Effect.sync(() => options.onChunk(chunk)));
  });

export const sendAtom = AppRpc.runtime.fn<
  { readonly send: Ask; readonly onChunk: (chunk: Chunk) => void; }
>()(
  (options) => turn(options),
  { reactivityKeys: [Keys.assistant] },
);
