# The MCP server

`apps/mcp` exposes this application to an editor as tools: contacts, files and
the caller's own identity. It is the same `AgentToolkit` the assistant uses, so
the two cannot drift into different capabilities.

## What it is, and is not

It speaks **stdio**, because that is how an editor starts an MCP server: as a
subprocess it launches itself, with credentials in its own configuration and no
port to expose. There is no HTTP transport here yet — that needs per-request
authentication, which is a different design, and is on the roadmap rather than
half-built.

Every tool runs the same policy as the equivalent screen, against the identity
the key resolves to. There is no separate scope vocabulary to keep in step with
`Permission.ts`, because there is no separate vocabulary at all.

## Connecting an editor

Create a key at `/settings/api-keys`, then:

```jsonc
{
  "mcpServers": {
    "vantion": {
      "command": "node",
      "args": ["/absolute/path/to/saas-starter/apps/mcp/build/bundle/main.js"],
      "env": {
        "DATABASE_URL": "postgresql://…",
        "VANTION_API_KEY": "vantion_live_…"
      }
    }
  }
}
```

`bun run --filter @vantion/mcp build` produces that bundle. For development,
`bun run --filter @vantion/mcp dev` runs it from source against the repo-root
`.env`.

## The key is the blast radius

The server runs as whatever the key is. A key carries a role, and the tools can
do exactly what that role can do — so give an editor the narrowest key that does
the job. `member` is usually right: it can read contacts and files and create a
contact, and it cannot touch billing, roles or members.

Revoking the key at `/settings/api-keys` stops the server working immediately,
which is the honest way to end a connection you no longer want.

## What a write does

`CreateContact` is marked `needsApproval`, so a client proposes it and executes
it only once the person says yes. The permission check decides whether they
_may_; approval decides whether they meant to. Those are different questions —
a model that misreads an instruction is acting entirely within its permissions
while doing the wrong thing.

Every write lands in the audit trail at `/settings/audit`, attributed to the
key rather than to a person, because that is the honest answer to "who did
this".
