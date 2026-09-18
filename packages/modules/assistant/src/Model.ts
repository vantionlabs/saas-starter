import { Config, Context, Effect, Layer, Option, Stream } from "effect";
import { LanguageModel, type Prompt, type Response } from "effect/unstable/ai";

/**
 * Whether this deployment can actually answer.
 *
 * Separate from the model itself so a handler can refuse *before* starting a
 * turn, with an error the contract declares. A model layer that failed on first
 * use would leave a half-written conversation behind.
 */
export class ModelStatus extends Context.Service<ModelStatus, { readonly configured: boolean; }>()(
  "AssistantModelStatus",
) {}

const finish: Response.StreamPartEncoded = {
  type: "finish",
  reason: "stop",
  usage: {
    inputTokens: { uncached: 0, total: 0, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 0, text: undefined, reasoning: undefined },
  },
  response: undefined,
};

/** The last thing the person actually typed. */
const lastUserText = (prompt: Prompt.Prompt): string => {
  for (let index = prompt.content.length - 1; index >= 0; index -= 1) {
    const message = prompt.content[index]!;

    if (message.role !== "user") continue;

    return message.content
      .filter((part): part is Extract<typeof part, { type: "text"; }> => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }

  return "";
};

/**
 * A model that does not exist, scripted to exercise the loop.
 *
 * It is opt-in — `ASSISTANT_MODEL=scripted` — and never a silent fallback. A
 * fake that switched itself on whenever a key was missing would let a
 * deployment ship an assistant that quietly answers from a lookup table, which
 * is worse than one that says it is not configured.
 *
 * What it is for: the tests and the browser suite, where the thing under test
 * is the tool loop, the approval gate and tenant isolation, none of which a
 * real model would test more truthfully — it would only make the result
 * non-deterministic and cost money.
 */
export const layerScripted: Layer.Layer<LanguageModel.LanguageModel | ModelStatus> = Layer.mergeAll(
  Layer.effect(LanguageModel.LanguageModel)(
    LanguageModel.make({
      generateText: () => Effect.succeed([]),
      streamText: (options) => {
        const asked = lastUserText(options.prompt).toLowerCase();

        if (asked.includes("add") && asked.includes("contact")) {
          // The parameters are lifted out of the sentence crudely, because what
          // is under test is the approval gate rather than the extraction.
          const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(asked)?.[0] ?? "someone@example.com";

          return Stream.fromIterable<Response.StreamPartEncoded>([
            {
              type: "tool-call",
              id: "scripted-call",
              name: "CreateContact",
              params: { email, fullName: email.split("@")[0] ?? "Someone" },
              providerExecuted: false,
            },
            finish,
          ]);
        }

        if (asked.includes("contact")) {
          return Stream.fromIterable<Response.StreamPartEncoded>([
            {
              type: "tool-call",
              id: "scripted-call",
              name: "ListContacts",
              params: {},
              providerExecuted: false,
            },
            finish,
          ]);
        }

        return Stream.fromIterable<Response.StreamPartEncoded>([
          { type: "text-start", id: "scripted-text" },
          { type: "text-delta", id: "scripted-text", delta: "No model is configured. " },
          { type: "text-delta", id: "scripted-text", delta: "This is the scripted stand-in." },
          { type: "text-end", id: "scripted-text" },
          finish,
        ]);
      },
    }),
  ),
  Layer.succeed(ModelStatus)({ configured: true }),
);

/**
 * No model at all: the handlers refuse before a turn starts, so this exists
 * only to satisfy the layer graph.
 */
const layerUnconfigured: Layer.Layer<LanguageModel.LanguageModel | ModelStatus> = Layer.mergeAll(
  Layer.effect(LanguageModel.LanguageModel)(
    LanguageModel.make({
      generateText: () => Effect.die("no assistant model is configured"),
      streamText: () => Stream.die("no assistant model is configured"),
    }),
  ),
  Layer.succeed(ModelStatus)({ configured: false }),
);

/**
 * OpenRouter when there is a key, the scripted stand-in when asked for, and a
 * refusal otherwise.
 *
 * OpenRouter rather than a single vendor because one key reaches every model
 * and changing which one answers is a string — `ASSISTANT_MODEL_ID`. The port
 * underneath is Effect's `LanguageModel`, so swapping OpenRouter itself for
 * Anthropic or OpenAI directly is one layer.
 */
export const layerModel: Layer.Layer<LanguageModel.LanguageModel | ModelStatus> = Layer.unwrap(
  Effect.gen(function*() {
    const model = yield* Config.nonEmptyString("ASSISTANT_MODEL").pipe(
      Config.withDefault("openrouter"),
    );

    if (model === "scripted") return layerScripted;

    const key = yield* Config.option(Config.redacted("OPENROUTER_API_KEY"));

    if (Option.isNone(key)) return layerUnconfigured;

    const { layerOpenRouter } = yield* Effect.promise(() => import("./OpenRouter.js"));

    return layerOpenRouter({
      modelId: yield* Config.nonEmptyString("ASSISTANT_MODEL_ID").pipe(
        Config.withDefault("anthropic/claude-haiku-4.5"),
      ),
    });
  }).pipe(Effect.orDie),
);
