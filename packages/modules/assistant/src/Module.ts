import { Layer } from "effect";
import { AssistantRpcLive } from "./AssistantRpcLive.js";
import { layerModel } from "./Model.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * The model comes with it, chosen from configuration: OpenRouter with a key,
 * the scripted stand-in when asked for, and a refusal otherwise. The toolkit
 * does not — `AgentModule` is the host's to register, because the same tools
 * are also what `apps/mcp` serves and neither should own the other.
 */
export const AssistantModule = AssistantRpcLive.pipe(Layer.provideMerge(layerModel));
