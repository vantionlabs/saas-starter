import { AgentToolkitLive } from "./ToolkitLive.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * It provides nothing of its own: the toolkit's handlers call the contact and
 * file stores, and those come from the modules an application already
 * registers. What this layer *is* is the binding between the tool declarations
 * and those stores — which is why both `apps/mcp` and the assistant can take
 * it and get the same capabilities.
 */
export const AgentModule = AgentToolkitLive;

export { AgentToolkit } from "./Tools.js";
