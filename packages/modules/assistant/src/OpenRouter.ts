import { OpenRouterClient, OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Layer } from "effect";
import type { LanguageModel } from "effect/unstable/ai";
import { FetchHttpClient } from "effect/unstable/http";
import { ModelStatus } from "./Model.js";

/**
 * The live model, in its own file and imported dynamically, so a deployment
 * without a key never loads the provider — the same bargain Stripe, Sentry and
 * the S3 client all make here.
 *
 * `FetchHttpClient` rather than the Node one: it is what the provider needs and
 * it is in the core package, so this adds no dependency of its own.
 */
export const layerOpenRouter = (options: {
  readonly modelId: string;
}): Layer.Layer<LanguageModel.LanguageModel | ModelStatus> =>
  Layer.mergeAll(
    OpenRouterLanguageModel.layer({ model: options.modelId }).pipe(
      Layer.provide(OpenRouterClient.layerConfig()),
      Layer.provide(FetchHttpClient.layer),
      // The key was read before this layer was chosen, so a config failure here
      // is a key that vanished between the two — unrecoverable either way.
      Layer.orDie,
    ),
    Layer.succeed(ModelStatus)({ configured: true }),
  );
