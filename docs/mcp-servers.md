# MCP servers for working on this repository

`.mcp.json` is the project's own list. A client that reads it starts these on demand;
none is required, and every one degrades to "not configured" rather than failing loudly.
The variables they interpolate live in `.env`, from `.env.example`.

This is separate from `docs/mcp.md`, which is about `apps/mcp` — the MCP server this
_product_ exposes to a customer's editor. That one appears below as well, because the best
way to know it works is to use it.

## What is wired, and why

| Server         | Needs                       | Why it earns a slot                              |
| -------------- | --------------------------- | ------------------------------------------------ |
| **vantion**    | `VANTION_API_KEY`           | This repository's own toolkit, run from source.  |
| **stripe**     | `STRIPE_SECRET_KEY`         | Prices, products and events against a sandbox.   |
| **railway**    | `RAILWAY_API_TOKEN`         | Services, variables, deploys and logs.           |
| **playwright** | —                           | Drives a browser, so a UI change can be checked. |
| **context7**   | optional `CONTEXT7_API_KEY` | Version-correct docs for the libraries here.     |
| **sentry**     | `SENTRY_ACCESS_TOKEN`       | The errors `packages/telemetry` reports.         |

**vantion runs from source**, not from a built bundle — `bun --conditions=development`
against `apps/mcp/src/Main.ts`. An editor pointed at a stale `build/bundle/main.js` is an
editor answering from code that is not the code you are editing. `docs/mcp.md` gives the
built form, which is what a _customer_ configures.

Dogfooding it is the point: the same five tools, the same `ApiKeyAuth`, the same policies
and the same row-level security a customer gets. If a tool is awkward here, it is awkward
there.

**playwright needs no credentials**, which is why it is on by default. It is also the one
with a real cost to understand: it drives a _real browser_ at whatever you point it at, so
treat it the way you would treat a shell.

**context7 is the answer to "is there a better-auth MCP server".** There is not.
`@better-auth/mcp` is a **plugin for building** an MCP server whose OAuth is better-auth's
— it is not a tool for working on better-auth, and wiring it up here would be a
misunderstanding committed to a config file. What is actually wanted is version-correct
documentation for better-auth, TanStack Start, Stripe and the rest, and that is Context7.

Its API key is optional and only raises rate limits.

## What is deliberately not wired

**Postgres.** `@modelcontextprotocol/server-postgres` is archived — "no longer supported" —
and every replacement is a third-party package that wants `DATABASE_URL`. Handing a
database credential to an unvetted dependency is not a trade this repository makes, and
there are two better paths already here: `psql` in the nix shell for raw SQL, and the
**vantion** server above for tenant data, which goes through the same policies and the same
row-level security rather than around them.

**Figma.** `docs/figma.md` explains it: how the server installs differs between the desktop
app, the remote server and each editor, and a wrong entry is worse than none. It also needs
a seat that can write.

**PostHog, Linear, Resend.** Useful, and none of them is about this codebase. Add them to
your own client config rather than to a template every generated repository inherits.

## The rule for adding one

Check the package is alive first. Two of the three servers this file started with were
**deprecated** when they were looked at: `@railway/mcp-server` ("now bundled into the
Railway CLI") and `@modelcontextprotocol/server-postgres`. Both had been sitting in
`.mcp.json` looking configured.

Then ask whether it belongs to _this repository_ or to _you_. A template's `.mcp.json` is
inherited by every project generated from it, so the bar is "somebody working on this
codebase needs it", not "it is good".
