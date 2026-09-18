import { NodeRuntime, NodeStdio } from "@effect/platform-node";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { AgentModule, AgentToolkit } from "@vantion/module-agent/Module";
import { BillingModule } from "@vantion/module-billing/Module";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { PermissionResolver } from "@vantion/module-iam/access/PermissionResolver";
import { ApiKeyAuth } from "@vantion/module-iam/apikey/ApiKeyAuth";
import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/unstable/ai";
import { IdentityLive } from "./Identity.js";

/**
 * This application as an MCP server, over stdio.
 *
 * Stdio rather than HTTP because that is how an editor starts one: as a
 * subprocess, with credentials in its own configuration and no port to expose.
 * The tools are `AgentToolkit` — the same declarations the assistant uses — so
 * there is one set of capabilities rather than two that drift.
 *
 * Nothing here is a new implementation. A tool calls `ContactStore`, which the
 * RPC handlers and the public API call, which runs the same policy against the
 * same identity under the same row-level security. That is the reason this app
 * is fifty lines rather than a project of its own.
 */
const ToolsLive = AgentModule.pipe(
  Layer.provide(IdentityLive),
  Layer.provide(ContactStore.layer),
  Layer.provide(ApiKeyAuth.layer),
  Layer.provide(PermissionResolver.layer),
  /**
   * Billing is registered for its `EntitlementResolver`, so `WhoAmI` reports
   * the plan the organization actually has. Without it every caller would look
   * like they were on `free`, which is a lie a model would then repeat.
   */
  Layer.provide(BillingModule),
  Layer.provide(PgLive),
  Layer.provide(PgPool.layer),
);

const McpLive = McpServer.toolkit(AgentToolkit).pipe(
  Layer.provide(ToolsLive),
  Layer.provide(
    McpServer.layerStdio({
      name: "vantion",
      version: "0.0.0",
      // Newest first: a client negotiates the most recent version both ends
      // understand, and the older adapters are there so an editor that has not
      // been updated still connects.
      protocols: [McpProtocol.v2025_06_18, McpProtocol.v2025_03_26, McpProtocol.v2024_11_05],
    }),
  ),
  Layer.provide(NodeStdio.layer),
);

NodeRuntime.runMain(Layer.launch(McpLive));
