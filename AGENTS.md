# SaaS starter

Effect v4 monorepo. pnpm workspace + `tsc -b` project references, oxlint + dprint, vitest.

`apps/` holds what deploys — `apps/server` is the Effect API, `apps/web` is the TanStack Start
front end, `apps/worker` runs the outbox relay and the jobs it feeds, and each owns its
`Dockerfile`.

The worker's loop is deliberate: relay a batch, _then_ drain and dispatch. The relay runs in a
transaction, and dispatching inside it would hold that transaction open for the length of
somebody else's HTTP timeout — which is how a slow customer becomes a database problem. With
`REDIS_URL` the drain is empty and BullMQ's own worker does the work; without it the in-memory
queue hands back what it is holding and the loop is the worker, which is what lets a fresh
clone deliver a webhook with no Redis at all.

`apps/design` deploys nothing, and it is the one canvas all three surfaces are worked on. It renders the same components from `@vantion/ui` against
persona fixtures, with no backend, no session and no network — the surface product designers
work on, and the one that pushes to Figma. The product screens, the marketing
sections and the brand kit all render from `@vantion/ui` here, so a designer opens one
application and `/figma-screen` reads one source — which is also why the presentational half of
`apps/marketing` and `apps/brand` lives in the design system rather than in those apps. What
stays behind is routing, metadata and copy: a designer changing a headline should not be editing
a route, and a component only one site can render is a component Figma cannot see.

Only the product screens have personas, because only they have states you cannot reach without
a backend. A persona is a whole tenant's worth of data rather
than a card on a wall: `first-day` where every list is empty, `settled` for the ordinary case,
and `crowded` for the long names and many rows that actually break a layout. The persona
travels in the query string, so a designer can link to exactly the state they mean. `pnpm
design`.

`apps/marketing` is the marketing site: several pages, server-rendered with TanStack Start for
the same reasons `apps/web` uses it, minus the session. It began as one prerendered page, and
stopped being the right shape the moment it had a navigation — once there are five routes, each
needing its own title, canonical and Open Graph tags, and a `sitemap.xml` to serve, rendering on
the server is the simpler thing rather than the heavier one.

Its pages are one list. `site.ts` declares them, the header and footer read it, the sitemap is
generated from it, and a test asserts the route files and that list are the same set — a route
nobody can reach and a nav link to nothing are both silent failures on a marketing site.
`meta()` builds every page's head in one place, because the failure is always the same: a page
gains a title and forgets the description, and nothing on screen shows it.

`robots.txt` and `sitemap.xml` come from a small Vite plugin rather than a build script, so
the config — which Vite already compiles — can import the same module the pages do. It is
listed _first_ among the plugins: its dev middleware has to run before Start's handler, which
otherwise answers `/robots.txt` with the router's not-found page.

Its pricing table is read from `@vantion/module-iam`'s own `features` and `limits`, not retyped
beside them. A pricing page promising ten seats while the application enforces three is the
commonest lie on a software website and always an accident; here a plan change is one edit and
a test fails the day the two disagree. Prices themselves are declared in the site, because what
an organization _may do_ and what it _costs_ are different decisions — one is enforced, the
other lives in Stripe.

The calls to action are anchors wearing `buttonVariants`, not the `Button` component: Base UI
sets `role="button"` even when rendered as an anchor, which is right for a control and wrong
for a destination.

`apps/brand` is the brand kit, and it is generated rather than written: every swatch, hex and
pairing comes from `@vantion/tokens`, and the email footer comes from `@vantion/emails`. A brand
document maintained by hand is out of date the first time somebody changes a colour, and then
it is worse than nothing because people still believe it. It also marks any token outside sRGB,
which is how one was caught before it shipped.

Its voice section is pairs rather than adjectives. "Be clear and friendly" is advice nobody can
apply; a sentence beside the one it replaces is a decision somebody can copy, and every
"instead" there is a string the product actually ships.

Both static apps build the same way — Vite bundles, a second SSR build renders the page, and
`prerender.mjs` writes it into `index.html` — and both ship as nginx images with no JavaScript
toolchain inside.

`packages/modules/*` holds one package per feature, `@vantion/module-<name>`. A module owns
its whole vertical: the contract both ends compile against, the RPC handlers, the stores, and
the services behind them.

| Module          | What it owns                                                           |
| --------------- | ---------------------------------------------------------------------- |
| `iam`           | identity, organizations, roles and policies, API keys, the audit trail |
| `contact`       | the worked example of a tenant-owned feature                           |
| `billing`       | subscriptions, Stripe, the entitlement behind every plan gate          |
| `files`         | uploads, object storage, expiring links                                |
| `jobs`          | the transactional outbox and the queue behind it                       |
| `webhooks`      | outbound delivery, signed and retried                                  |
| `agent`         | the toolkit an MCP client or a model drives, over the modules above    |
| `notifications` | the mail transport                                                     |
| `health`        | liveness and readiness                                                 |

Inside a module, a sub-domain gets a directory — iam has `identity/`, `auth/`, `access/`,
`organization/`, `apikey/`, `audit/`, `session/` — and each RPC operation gets a file named
after it, built with `RpcGroup.toLayerHandler`. A handler therefore declares its own
requirements instead of inheriting whatever shares a closure with it, and the group's
`*RpcLive.ts` is a `Layer.mergeAll` and nothing else. Handlers live with their concern, not
with their transport group: `CreateApiKey` is in `apikey/` though its procedure belongs to the
organization group.

Every module exports a root layer from `Module.ts` — `IamModule`, `ContactModule` — which is
what an application registers. HTTP routes are exported separately (`IamHttp`,
`HealthHttpRoutes`) because a route layer requires the `HttpRouter` it adds itself to, and
that service only exists inside `HttpRouter.serve`.

`apps/mobile` keeps its router root at `src/app`, which Expo prefers over a top-level `app/`
without being told to — so everything that is source lives under `src/` here as it does in
every other app, and what stays at the root is configuration. `apps/mobile` is Expo and
expo-router over that same package: the contacts screen renders
`contactsAtom`, not the mobile equivalent of it. What differs is the rendering layer —
`packages/ui` is HTML for a browser and a phone needs `View` and `Text` — and how the session
is carried, since React Native has no cookie jar and `@better-auth/expo` puts the token in the
keychain instead. `docs/mobile.md` has the three seams Metro needs and is explicit that the app
compiles and bundles but has not been run on a device here.

`packages/core` is everything a client needs that is not a screen. Five files at its root are
the foundation every feature builds on — `AppRpc` (the one client and its atom runtime),
`ApiUrl`, `Keys`, and the two combinators `Stable` and `HoldOpen` — and `atoms/` is one file
per feature beneath them. The split is the same one `packages/modules/*` makes: what a reader
is looking for is a feature, and what they need to understand first is the machinery under all
of them. It exists because
`apps/web` and `apps/mobile` are two front ends over one contract, and a query written twice is
a query that behaves differently twice.

Nothing in it touches the DOM. What stayed behind in `apps/web` is the auth client and the
session atoms, because those build callback URLs from `window.location` and hold a cookie —
a native app does neither.

`ApiUrl.ts` is the seam between the two bundlers, and it is smaller than it looks: Vite
substitutes `import.meta.env.VITE_*` and leaves `process.env` alone, Metro inlines
`process.env.EXPO_PUBLIC_*` and has no `import.meta.env` at all. Reading both names through
**dot access** is what makes one expression serve both — a bracket read is not substituted, so
the value would be `undefined` in a browser and every call would quietly go to localhost. The
web app's Vite config defines the one name it needs.

`packages/emails` holds the transactional mail as React components, rendered with
`@react-email/render` to HTML _and_ plain text. Both, always: a message with no text part is
one some clients show empty and some filters score as spam, and the text is what makes a magic
link followable out of the server log when `RESEND_API_KEY` is unset. Subject and body are
declared together in one `Email`, because kept apart they drift and the reader gets "Verify
your email" above a password reset. It is the fourth consumer of `@vantion/tokens` — converted
to hex, because no mail client reads `oklch`.

Every file in `packages/emails` and `packages/ui` is `.tsx`, including those with no JSX. The
`exports` map can name one extension, so a single `.ts` among them resolves to nothing at run
time while type-checking perfectly.

`packages/tokens` holds the palette, radius and font stacks in TypeScript and generates the
stylesheet from them, because three consumers need the same values and only one speaks CSS —
the web app, the Expo app through NativeWind, and Figma through the library generator.
`packages/ui` holds the 35 presentational components: the shadcn primitives on Base UI, the
shell pieces, and the feature components, all prop-driven. The nine components that read atoms
stay in `apps/web`, because a component that fetches is connected to an application rather than
shared with one.

Two things follow from `packages/ui` being a separate package. Tailwind scans the importing
project, so `apps/web/src/app.css` names it with `@source` — without that every utility the
primitives use is absent from the bundle and nothing warns. And `LinkProps["to"]` is only
`string` there, because the route union comes from the generated route tree, which belongs to
the application.

Beneath them, `packages/database` owns the connection and the schema, and `packages/domain`
is now only an aggregator: `AppRpcs`, which composes the modules' RPC groups into the one both
apps import, and the frozen `api/v1` wire types.

`packages/modules/agent` is the odd one out and deliberately so: it owns no tables and no
transport, only the binding between a set of tool declarations and the stores that already
implement them. `AgentToolkit` is five tools — identity, two reads, a search and one write —
and each handler calls the same `ContactStore` or file query the RPC handlers and the public
API call, through the same policy, under the same row-level security. A tool is a fourth
transport over one implementation, never a fourth implementation.

Tools declare their `dependencies` rather than letting the handler's requirements be inferred,
so the toolkit's layer states what it needs the way every other layer here does. The one write
carries `needsApproval`, which is the model's own machinery: a client proposes it and runs it
only once the person agrees. The permission check decides whether they _may_; approval decides
whether they meant to, and a model that misreads an instruction is acting entirely within its
permissions while doing the wrong thing.

`packages/modules/assistant` is the other consumer of that toolkit: a conversation, a model and
the loop between them. `Chat` owns the history and runs the loop — call the model, execute the
tools it asks for, feed the results back, ask again — and what the module adds is the
translation into chunks a screen can render, the product's own record of the turn, and where it
stops.

Two tables, two jobs. `message` is the record: what was asked, what was answered, which tools
ran, in order, and it is what the screen reads. `conversation.state` is the provider's encoded
prompt, opaque and separate, because continuing a conversation means handing back tool calls,
results and approval responses in the shape the library produced them — reconstructing that
from our own rows would be a second implementation of somebody else's protocol. It is a cache:
delete it and the conversation still reads correctly, it just cannot be continued.

**Writes stop and ask.** `CreateContact` carries `needsApproval`, so a turn that wants it emits
an approval request and ends there, with the history saved. Nothing is written until `Approve`
says so, and a declined approval goes back into the history as a refusal the model can see —
so it says what it did not do rather than trying another route to the same write. A test
asserts the row does not exist before approval and does after.

Tool refusals are **values, not failures**. `failureMode: "return"` means a model that reaches
for a tool the caller may not use is told "you lack `contact:create`" and carries on with what
it can do, instead of the turn dying on a policy error.

Without `OPENROUTER_API_KEY` the assistant refuses rather than answering: `AssistantUnavailable`
distinguishes `NotConfigured` from `ProviderFailed`, because one is your configuration and the
other is somebody's outage. `ASSISTANT_MODEL=scripted` opts into a deterministic stand-in that
drives the same tools through the same gate, which is what the tests use — never a silent
fallback, because a deployment that quietly answers from a lookup table is worse than one that
says it has no model.

The screen is `/assistant`, built from `@vantion/ui/assistant` — components adapted from
Beautiful UI (MIT, recorded in `NOTICE`). Two things about that adaptation are load-bearing.
Its stylesheet defines _its_ token names in terms of `@vantion/tokens` rather than shipping a
second palette, so the assistant looks like the rest of the product; and it is scoped to a
`.bui` class because Beautiful UI's `--accent` is an action colour while ours is a muted
surface — same name, opposite meanings, so the components must render inside that wrapper and
`Conversation` provides it.

A pending approval lives in the stored conversation, not in the page. `GetMessages` returns it
alongside the messages, read out of the history as a request with no response — so opening
another tab to check something before answering does not lose the decision. The first version
kept it in React state and cleared it when the stream ended, which made the card appear and
vanish in the same frame: a turn _ending_ is not a turn _finishing_, and only the browser test
could have caught the difference.

`evals/` is the assistant's test set and the baseline the build compares against, and it runs
inside `pnpm test` rather than beside it. What it can enforce on every push is the half that
must hold whatever a model says — the right tool is reached for, a write stops and asks, a
refusal comes back named, one tenant's question never reaches another's rows — so it runs
against the scripted stand-in, deterministically and for nothing. The other half, whether a
model _chooses_ well, needs a key and a baseline recorded for that model; `docs/evals.md` is
clear about which is which, because a gate that pretends to measure quality is a gate somebody
disables.

Two rules decide it: a pass rate may drift five points, and a **new** critical failure fails
the build whatever the rates say. A run is never compared against a baseline from a different
model — that number would mean nothing, so it refuses.

The cases are written in `vantionlabs/eval-harness`'s file format so the same file can be
graded there against a rubric, with three columns of our own for what a text-only harness
cannot express: an approval gate, a permission refusal, and which role is asking.

One ordering is worth knowing, and `ASSIST-003` exists because of it: approval is evaluated
_before_ the handler runs, so a gated tool stops to ask before reaching the policy that would
refuse it. Putting a permission check inside `needsApproval` would put authorisation in a
second place, so the case tests a refusal on a read instead.

`apps/mcp` is that toolkit over stdio, which is how an editor starts an MCP server: a
subprocess with credentials in its own configuration and no port to expose. It resolves
`VANTION_API_KEY` once at boot through the same `ApiKeyAuth` the public API uses, so the
process runs as one identity for its lifetime — no per-request authentication, and the key is
the blast radius. `docs/mcp.md` has the editor configuration and says so plainly.

`apps/server/src` is three files — `Main.ts`, `Telemetry.ts` and the `api/v1` handlers. That
is the measure of whether this is working: an application composes modules and owns almost
nothing itself.

`pnpm new:module <name>` writes a module and registers it. A module is five config files
before it is a line of code, two of which register it elsewhere — a reference in
`tsconfig.json`, a path in `tsconfig.base.json` — and by the fifth module one of those gets
forgotten, with the failure reading as a resolution error three files away. It also writes a
worked `List…` operation, so the conventions are in the tree rather than only in `RULES.md`.

What it deliberately leaves to you is what the application serves: adding the group to
`AppRpcs` and registering the module in `Main.ts`. Those are decisions, not side effects of
creating a directory. The command prints them.

Dependencies point one way: `apps/` → `packages/domain` → `packages/modules/*` →
`packages/database`. A module may depend on another module, never on `domain` or on an app.

That direction is what the split of `OrgScope` is about. `withOrgScopeFor` takes a plain org
id and lives in `packages/database`; `withOrgScope` reads it from `CurrentUser` and lives in
`@vantion/module-iam`, because reading the caller is an identity concern and `database` would
otherwise have to depend on the module that depends on it.

For the same reason `ApiKeyAuth.authenticate` takes the presented key rather than an
`HttpServerRequest`: `bearerToken` pulls it off an `Authorization` header at whichever
transport is asking, so the public API and anything else — an MCP server, a worker — share one
implementation instead of two.

## What the work is, and where it got to

`docs/workflow/` holds the four phases — discover, prototype, build, ship — and
two files carry a product between sessions, answering different questions.

`SPEC.md` is **what the work is**: who it is for, the riskiest assumption, the
slices in dependency order, and what was cut with the reason beside it. Discovery
writes it from `SPEC.md.example`; it is committed, because a change to the scope
deserves a diff and somebody's name on it. `/product-build` takes the topmost
slice that is not `landed` rather than building what the conversation suggests —
a feature list improvised at build time is how a cut item quietly returns.

Two of its columns are binding. **Tenant-owned** is what commits a slice to a
row-level security policy, `withOrgScope`, and a case in
`e2e/tests/tenancy.spec.ts`, so a blank one is a decision nobody took. **Shown
by** names what must exist before a row may be called landed, because a slice
nobody can demonstrate is a slice nobody can tell is finished.

`STATE.md` is **where the work got to**. It is gitignored and read back by
`SessionStart`, which is the only reason a thread survives a context window
closing. When the two disagree the spec is right and `STATE.md` is stale.

Neither file is in this repository, only their templates — the starter has no
product. `tooling/test/workflow.test.ts` keeps the two ends of that handover
honest: the section numbers the commands cite, the columns they read, the states
they set, which of the two files is ignored, and every link between the phase
documents. A command telling an agent to read a section that has been renamed
reads exactly like one that is right.

## Read the vendored Effect source before writing Effect code

`repos/effect` is the full Effect monorepo, vendored with `git subtree` at exactly the version
this repo depends on (`effect` in `pnpm-workspace.yaml`, currently `4.0.0-rc.109`).

That word _exactly_ is load-bearing, and it was briefly untrue. Both sources were vendored from
`main`, where a package's version field still reads as the last release while the source has
already moved past it — so the copy claimed to be rc.109 and carried APIs rc.109 does not have.
Writing this repository's own MCP server against it produced calls to `McpProtocol.v2025_11_25`
and an option that does not exist. The refs in `scripts/vendor-sources.json` are release tags
now, and `tooling/test/vendor-sources.test.ts` fails if one is ever a branch again. It also
covers `@effect/atom-react`, `@effect/vitest`, `@effect/sql-pg`, `@effect/platform-node`, and
the AI packages.

Read it **first**, not as a fallback. Do not wait until you feel unsure — Effect v4 is a
release candidate whose APIs moved recently, so confident recall is exactly the failure mode
this guards against. Open the real signature in `repos/effect/packages/*/src/` before you use
an API you have not already read in this session.

`repos/effect-form` is vendored the same way, at the versions installed here
(`@lucas-barake/effect-form@0.25.0-beta.6`, `@lucas-barake/effect-form-react@0.26.0-beta.5`).
Its published `latest` still targets Effect v3; the repo's `main` branch is the v4 line, which
is why the catalog pins the beta. There are no published docs for the v4 API, so
`repos/effect-form/packages/form*/src/` is the only reference — read it before using a form API.

## Precedence

When sources disagree, higher wins:

1. `repos/effect` — the actual source of the version installed here
2. `RULES.md` — hard repository rules
3. `knowledge/rules/` and `knowledge/skills/`
4. Your own recall — never authoritative for Effect APIs

This ordering applies to `RULES.md` and `knowledge/` themselves: where their example code
contradicts `repos/effect`, the vendored source is correct and the doc is stale. Their
_intent_ still stands — only the API spelling defers.

## Corrections already applied

`RULES.md` and `knowledge/skills/` have been corrected against rc.109. Each was confirmed by
reading the vendored source or by a compiler error, not inferred:

| Was                       | Now                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ServiceMap.*`            | `Context.*` — there is no `ServiceMap` module                                                                                 |
| `Schema.TaggedErrorClass` | `Schema.TaggedError`                                                                                                          |
| `.asEffect()`             | removed in v4; yieldables that are Effects pipe directly, and `Option`/`Result` use `Effect.fromOption` / `Effect.fromResult` |
| `Effect.fromYieldable`    | does not exist                                                                                                                |
| schema `makeUnsafe()`     | `.make()`, which validates                                                                                                    |
| `@effect/platform`        | gone in v4 — `effect/unstable/http`, `.../socket`, or `@effect/platform-node` / `-browser`                                    |

`Latch.makeUnsafe`, `Ref.makeUnsafe`, and `Deferred.makeUnsafe` are **real** and were left alone —
`makeUnsafe` is only wrong on schemas.

`knowledge/skills/` diverges from the upstream dotfiles repo on purpose. `pnpm sync:skills`
re-applies every correction above after fetching, and fails without writing if any known drift
survives — so a sync cannot silently reintroduce v4-invalid APIs.

Assume more drift exists than is listed here. Check the source.

## Do not touch `repos/`

- Never edit files under `repos/` unless explicitly asked.
- Never import from `repos/`. Application code imports from normal package dependencies.
- `no-relative-import-outside-package` and the `@/` alias are for intra-repo imports only.

Re-vendor a copy when its pinned version moves:

```
pnpm vendor              # every source in scripts/vendor-sources.json
pnpm vendor effect       # just one
```

Not `git subtree pull`. This history is squashed at publication, and a repository
generated from the template starts with no history at all, so a pull has no merge base
to work from. `scripts/vendor.mjs` removes the directory and adds the subtree afresh,
which works in any history and does not conflict the way a pull across 3,500 files does.

## Commands

|                                              |                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                   | API server and the Start client together, in parallel              |
| `pnpm build`                                 | deployable artifacts for the database, API and web packages        |
| `pnpm check`                                 | `tsc -b` across all project references, then the config files      |
| `pnpm lint`                                  | oxlint, incl. Effect type-aware rules and the local `app/*` plugin |
| `pnpm format` / `format:check`               | dprint                                                             |
| `pnpm test`                                  | vitest across `apps/*` and `packages/*`                            |
| `pnpm e2e`                                   | Playwright, driving both servers in a browser                      |
| `pnpm new:module <name>`                     | scaffolds `packages/modules/<name>` and registers it               |
| `pnpm design`                                | the product-design app, on persona fixtures                        |
| `pnpm --filter @vantion/tokens figma:script` | the Figma variable sync, printed                                   |

The second half of `pnpm check` is `tsconfig.tools.json`, which type-checks what
project references cannot: the Vite and Vitest configs, `vitest.shared.ts`,
`setupTests.ts`, and `.railway/railway.ts`. These are ordinary TypeScript that
nothing else compiles, so without it an error there surfaces only when the tool
that loads the file runs.

`pnpm dev` reads the repo-root `.env` — copy `.env.example` and fill it in. The API server's
port is `PORT`; the client derives its own from `WEB_URL`, so the two cannot drift apart.

Postgres-backed tests need a database. They skip without one. Either `docker compose up -d`,
or point at an existing instance with `TEST_DB_URL=postgresql://...`.

`pnpm e2e` is the browser suite in `e2e/`, and it needs nothing set up. It starts a Postgres
container of its own on a free port, applies the migrations, runs both servers on 3100 and
5273 so a running `pnpm dev` is undisturbed, and removes the container afterwards even when
the run fails. `pnpm --filter @vantion/e2e install-browsers` once, first.

Each test signs up its own user, so no two share a tenant and they run in parallel against one
database — which is also why none of them truncates a table. The suite presents a different
`x-forwarded-for` per test: the credential endpoints are rate-limited per caller, and a
parallel suite arriving from one address would exhaust the bucket rather than test anything.

`e2e/tests/tenancy.spec.ts` is the file to keep working. Unit tests cover row-level security
and `withOrgScope` separately; only that file shows two real users, session to SQL, failing to
see each other's rows.

The same procedures are served over a websocket at `/rpc/ws` as well as over HTTP at `/rpc`.
Most products do not need one, and it costs nothing until a client opens it: same `AppRpcs`,
same handlers, same modules, a different protocol underneath. What it buys is streaming —
`Health.Watch` is one connection producing reports rather than a poll — and a lower per-call
cost once a page is making many. `RULES.md` requires Effect's own socket abstractions for
this, which `RpcServer.layerProtocolWebsocket` is.

The server also exposes a versioned public HTTP API at `/api/v1`, authenticated by API key
rather than by session, with its OpenAPI document at `/api/v1/openapi.json` and browsable docs
at `/api/v1/docs`. Both transports run over the same stores, so a handler is not written twice;
`packages/domain/src/api/v1/Wire.ts` is the frozen contract and explains what may change in it.
`GET /health` is liveness and `GET /ready` is readiness.

`pnpm build` compiles every package and bundles the two runnable entry points with Vite — the
same tool the web app is built with, configured the same way. The API runs from
`apps/server/build/bundle/main.js`, the web server's `apps/web/.output/server/index.mjs` is the web server, and the migration runner sits at
`packages/database/build/bundle/migrate.js` with its `.sql` files beside it.

Bundling is an optimisation, not a workaround: `tsc` output runs on plain Node as it is. A bundle
just carries only the code actually reached — about 9MB of a 250MB dependency tree, the rest being
other entry points, declarations, source maps and CJS duplicates. That is the difference between a
182MB image and a 945MB one.

`packages/domain` and `packages/database` declare conditional `exports`:
source under a `development` condition, built JavaScript otherwise. Every dev tool asks for
`development` — `tsx` through `--conditions`, Vite and Vitest through `resolve.conditions` — and
plain Node gets the built output. `apps/server` does the same for its own internal `#src/*`
imports, which is why they are Node subpath imports rather than a `@/` alias a bundler would have
had to rewrite.

Each app owns a `Dockerfile`, built from the repository root because pnpm resolves a workspace
package against the root lockfile and every sibling manifest:

```
docker build -f apps/server/Dockerfile -t vantion-api .
docker build -f apps/web/Dockerfile    -t vantion-web .
```

Neither image carries `node_modules`, and both run on Alpine even though the build stage needs
Debian — `effect-tsgo` has no musl build, but nothing installs at runtime. The API image also
carries the migration runner, so a release applies migrations as its own step rather than at boot.

The web app builds through Nitro's Vite plugin, which turns Start's fetch handler into
`.output/server/index.mjs` — a server `node` runs directly, with no host to write.

The browser talks to the API directly. Every auth route and every RPC lives on `apps/server`, so
`VITE_AUTH_BASE_URL` names it and the web server proxies nothing. That prefix is not decoration:
Vite only exposes `VITE_` values to the client bundle, and it substitutes them at build time — so
the variable is a build argument for the web image, not a runtime one, and it must be the API's
_public_ address because a browser resolves it.

The cost of that directness is cookies. Two origins means the session cookie is only sent if the
browser considers them the same site, which needs both under one parent domain —
`app.example.com` and `api.example.com`, with `AUTH_COOKIE_DOMAIN=.example.com`. It cannot be a
public suffix, so two generated `*.up.railway.app` hosts can never share one: splitting the
services on Railway needs a domain of your own. Sharing a host instead — one origin, a reverse
proxy in front — works with `AUTH_COOKIE_DOMAIN` left empty.

Background work goes through an outbox rather than straight to a queue. `Outbox.enqueue`
writes a row inside whatever transaction the caller is already in, so the job and the change
it describes commit together or not at all — no job fires for a write that rolled back, and no
committed write loses its job. Redis cannot offer that, because enqueueing there is a second
system and a crash between the two leaves one of them wrong.

`Relay.run` then moves committed rows into BullMQ, which owns scheduling, retries, concurrency
and the dashboard. It claims a batch with `for update skip locked`, pushes, and marks relayed
in one transaction: a failed push rolls back and is retried, and a crash between push and
commit relays twice. **Delivery is therefore at-least-once and handlers must be idempotent** —
a duplicate a handler can tolerate is a better failure than a job that silently never ran.

Without `REDIS_URL` the queue is in-memory, the same way the mailer writes to the log without
a Resend key. The outbox is still transactional; nothing survives a restart.

Single sign-on is `@better-auth/sso`, per organization: a provider carries the
organization that owns it and the email domain that routes to it, so `/sign-in/sso`
takes an address and finds the right identity provider. OIDC and SAML 2.0 both.

Two questions gate it and they are asked in two places because they fail separately.
Whether the _person_ may is `hasOrgAdminRole` inside the plugin's own handler — owner
or admin — and `Permission.ts` carries `sso:manage` with the same grants deliberately,
so our screens ask what better-auth will ask again. Whether the _organization_ may is
`feature("sso")`, which better-auth cannot answer because a plan lives in a table its
plugin has never heard of; that is a `before` hook calling `ssoEntitled`, resolved per
request so an upgrade lands on the next registration rather than the next deploy.

`domainVerification` is on, and it is the whole security story. Without it anybody who
may register a provider can claim `acme.com` and become the identity provider for
everyone whose address ends that way. A registered provider therefore routes nothing
until DNS carries its token, and a test asserts `domainVerified` is false on the way
out — a provider that works too early works exactly like one that works.

The settings screen registers **explicit endpoints** with `skipDiscovery` rather than
by discovery. better-auth checks a discovery URL against `trustedOrigins` before
fetching it, which is right — the URL comes from whoever is registering the provider —
but it makes discovery an operator's decision and a restart. Explicit endpoints need
only be publicly routable, so adding a customer's IdP is a row.
`SSO_DISCOVERY_ORIGINS` exists for deployments that prefer the other way, and is empty.

`/settings/sso` is the screen, and `/auth/sso` is how somebody signs in through one — by
**email address**, never by picking from a list, because a picker on a multi-tenant product
shows every customer who the other customers are. The settings page narrows better-auth's
provider list to the active organization: `/sso/providers` returns every one the caller
administers across organizations, which is right for the endpoint and wrong for a page
titled with one organization's name.

Both go through the auth client rather than through RPC. `/sso/providers` already filters to
what the caller administers and already strips the client secret, and `/sso/register` already
validates the endpoints and refuses a non-member — an RPC in front of either would be a second
implementation of both, free to disagree with the one that actually runs.

Neither half of `domainVerification` can be switched off quietly, which is deliberate: drop it
on the client and `settings/sso.tsx` stops compiling, because it reads the token; drop it on
the server and `Sso.test.ts` fails, because it asserts the token comes back.

`ssoProvider` is the first organization-owned table here with **no row-level security**,
and `0011_sso.sql` says why at length: better-auth writes it outside any `withOrgScope`
transaction, so a policy in the usual shape would refuse its inserts, and one that made
room for a null `app.current_org` would permit every unscoped read while still reporting
`relrowsecurity` as true. That is the appearance of defence, which is worse than none.
`member`, `invitation` and `organizationRole` are unpolicied for the same reason.
`docs/sso.md` is explicit that no sign-in has been performed against a real identity
provider in this repository.

The seat limit is enforced inside better-auth rather than by a policy of ours. It owns the
invitation endpoints, so a check on our side is one an invitation created through its own API
walks straight past — `membershipLimit` asks per invitation, which is also what makes an
upgrade take effect on the next invite rather than the next deploy.

Plans do not live in `Permission.ts`. That object is also handed to better-auth's
access-control builder, and a plan is not a capability a _person_ has — it is one the
organization has, and some of it is quantities rather than booleans. So `Permission` answers
"may this person" and `Entitlement` answers "may this organization", and `Policy.all`
composes them: `all(permission("ac:create"), feature("custom_roles"))`. Nothing new was needed
to make that work, because `Policy` was already generic over its requirements.

`AuthMiddleware` provides both, resolved once per request, so a handler guarded by a
permission _and_ a feature costs one resolution rather than two. Where the entitlement comes
from is a port: `EntitlementResolver` lives in iam with a `layerFree` default, and
`@vantion/module-billing` implements it against the `subscription` table. Registering
`BillingModule` instead of `EntitlementResolver.layerFree` is the whole of turning billing on.
iam therefore knows nothing about subscriptions, Stripe, or where a plan is stored.

Which feature sits on which plan is an example and meant to be changed; the tests assert the
structural properties instead — that the plans nest, that every limit rises, and that between
them they carry everything. A plan set that stopped nesting would let an upgrade silently take
something away.

Stripe writes that subscription and nothing else does: the table's `with check` is
worker-only, so a customer cannot change their own plan by asking the API nicely. Three
things have to hold for the webhook to be safe and each is handled separately because each
fails separately — `stripeEvent` is the ledger against redelivery, `lastEventCreated` holds
Stripe's own timestamp so an event older than the state it is looking at is dropped, and the
organization arrives on the subscription's metadata because the first event for a customer has
no row to look one up from. Guessing would mean writing somebody else's plan onto a tenant.

`/settings/billing` is the screen over all of that: what was bought, what is
effective, what each plan carries, and the two buttons that leave for Stripe's
own pages. Checkout and the portal return a URL rather than redirecting, and the
return addresses are built from `WEB_URL` on the server — a return address a
client chooses is an open redirect with a payment page in front of it.

Billing has permissions of its own rather than borrowing `organization:update`.
`billing:read` is what the screen needs, `billing:manage` is what sends somebody
to Stripe, and only the owner holds the second: an admin runs the organization
and can see the bill, which is the same line `organization:delete` is drawn on.

`currentSubscription` filters by organization _and_ runs in `withOrgScope`,
which is the house rule rather than belt and braces. A superuser — or any role
with BYPASSRLS — ignores row-level security even on a FORCEd table, which is
what the test database is and what a managed Postgres often hands you. The first
draft relied on the policy alone and every organization read the first
subscription row in the table; the tests caught it because other blocks in the
file had already paid.

`BillingErrors.ts` exists for a reason no type-checker can see. The RPC contract
declares `StripeUnavailable`, both ends compile against the contract, and
`StripeClient.ts` reaches the SDK through a dynamic `import` — which a bundler
follows statically. For one commit the browser bundle carried 135 kB of Stripe's
Node SDK. The errors live in a leaf file now, and a test walks the contract's
import graph to keep it that way.

The plan a price maps to is read from its metadata, never a hard-coded price id: ids differ
between every account, so hard-coding one makes the build wrong everywhere except where it was
written. Without `STRIPE_SECRET_KEY` checkout and the portal refuse rather than returning a
fake URL that leads nowhere.

Outbound webhooks ride on that. `ContactStore.create` writes the contact and its
`contact.created` event in one `withOrgScope`, so a subscriber never hears about a row that
was rolled back and a row that exists always had its event written. `Outbox.enqueue`
deliberately does not open a transaction of its own — one that did would commit separately,
which is the failure the outbox exists to prevent. Called outside a scoped transaction it is
refused by the table's `with check` rather than writing something unscoped.

Deliveries are signed with Stripe's scheme — `Webhook-Signature: t=…,v1=…` over
`${timestamp}.${body}` — because customers already have code for it and there is a document to
point at. `sign` and `verify` live in the same file so the tests verify with the function a
customer will write against, and the delivery tests run a real HTTP receiver rather than a
stub: the thing worth proving is that somebody else's server accepts what we send.

`Webhook-Id` carries the outbox row's id, stable across retries, which is what lets a receiver
deduplicate an at-least-once delivery. An endpoint that fails ten times consecutively is
switched off, so a receiver that has been gone for a week stops costing an attempt a minute.

Uploads never pass through this application. `RequestUpload` signs a URL, the browser PUTs the
bytes at it, and `CompleteUpload` asks storage how big the object actually is — because a client
saying "done" is a claim, and the size in the request was only what somebody intended to send. A
row is written before the bytes exist, `pending`, since a presigned URL names a key and a key
nobody has recorded against a tenant is an object with no owner.

Keys are generated and never accepted: `${organizationId}/${uuid}`, with the caller's filename
kept as display text only. The prefix means a bucket policy can be written against it, so a
mistake is caught by storage as well as by row-level security.

Without `S3_BUCKET` and `S3_ACCESS_KEY_ID`, uploads go to `FILES_DIR` and the API serves them
from `/files/*` — signed, expiring, and authorised by the signature alone, since the point of
such a URL is that it can be given to an `<img>` tag that will not send a cookie. Those routes
exist only in that configuration; with a bucket they are absent, because the browser talks to
storage directly and this process should never see a byte of anybody's file.

What the signature covers is the whole of the security: the key, the expiry **and** the content
type. Leaving the type out would let a caller have their own upload served as `text/html`, which
is a cross-site scripting hole with an upload form in front of it.

The storage allowance is a plan limit (`limits.storageMb`), checked before a URL is signed
rather than after the bytes land — the last moment the application can still say no is before it
hands out permission to write.

The auth endpoints are rate-limited per caller, and who the caller _is_ depends on
`TRUST_PROXY`: the number of reverse proxies in front of this process, `0` by default and
`1` on Railway. At `0` the socket address is used and `X-Forwarded-For` is ignored. Above it
the header is read from the **right**, because each hop appends and only the rightmost entries
were written by something we trust — the leftmost is whatever the client sent. Reading that
one, as this code once did, lets a caller mint a fresh rate-limit bucket per request, and on
the OTP path the limit is the security boundary rather than a politeness measure.
`apps/server/src/iam/ClientAddress.ts` is the whole of it, and it is tested directly.

The API allows exactly one CORS origin, `WEB_URL`, which is already the origin better-auth
trusts. Widening it would only let a request through that better-auth then refuses.

`.railway/railway.ts` describes the whole Railway project: Postgres, Redis, all three
services, their Dockerfiles, health check, watch patterns, and the variables wiring them
together. The worker carries no domain and no health check because it serves nothing, and it
does not run migrations — the API's `preDeployCommand` does, and two services migrating one
database is the race that command exists to avoid. `railway
config plan` shows the diff and `railway config apply` performs it. Two lines change on a fork —
the repository and the project name.

Secrets are `preserve()`, so the file plans no change to them; set `AUTH_SECRET` and the rest in
Railway once. Two variables are load-bearing rather than cosmetic. The API's `WEB_URL` must be
the web service's public URL, because `Auth.ts` passes it to better-auth as a trusted origin and
a browser POST from any other origin is refused outright. The web service's `AUTH_BASE_URL`
points at the API's _private_ domain, because both the SSR session lookup and the proxy above are
server-to-server inside the project.

Railway's IaC API is in beta and its own README says it will change. The stable alternative is a
`railway.json` per app, which covers build and deploy settings but cannot create the database or
the services.

`packages/telemetry` owns both halves of observability, and both processes use it.

Tracing is exported only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set — unset installs no exporter
at all, because one pointed at nothing retries on a schedule and fills the log. `RULES.md` says
not to add manual logging on error paths because spans already carry the context; this is what
makes that true. Each process passes its own name to `layerTelemetry`, so the API and the
worker do not merge into one unreadable service.

Error tracking is a separate question from tracing and is answered separately. A span says
what one request did; `ErrorTracker` says the same failure has happened four hundred times
since Tuesday and which release started it. Traces are not aggregation, and the gap between
them is what a deployment actually notices an outage with.

It is wired as a **logger**, not as a call at each failure site. `RULES.md` forbids manual
logging on error paths, so the sites that would have called a tracker by hand do not exist —
what remains is the deliberate `Effect.logError`s and whatever the runtime reports when a
fiber dies. `layerReporting(source)` forwards every entry at `Error` or above and nothing
below, because a tracker that also collected `info` would report a deploy as an incident.

The browser half lives in `apps/web/src/telemetry/` rather than in that package, because it is
application wiring rather than a shared boundary: listeners on `window`, the root route's error
component, and four web vitals. It reports through the same shape — a reporter with a
credential-free implementation and a vendor-backed one behind `VITE_SENTRY_DSN`.

Two differences from the server are deliberate. The credential-free reporter _does_ write to the
console, because a React error boundary swallows what it catches: without that line the crash a
user just saw leaves no trace anywhere. And it drops vitals rather than printing them, since
three numbers from one page load on one machine are not data — they are only worth anything
aggregated.

`installClientTelemetry` returns its own undo, which is what makes it safe as a React effect:
effects run twice in development, and a second pair of listeners would report every error twice,
which is indistinguishable from a bug happening twice.

`VITE_` matters here for the same reason it does for `VITE_AUTH_BASE_URL`: Vite substitutes
these at build time, so the browser DSN is a build argument for the web image and not a runtime
variable. The SDK is behind a dynamic import either way, so a build without a DSN never fetches
the 447 kB chunk.

Without `SENTRY_DSN` the tracker is a no-op that deliberately logs nothing: whatever reached
it was already logged by the logger that called it, and a second line saying the same thing
teaches people to ignore both. The SDK is loaded through a dynamic import, so a process
without a DSN never pays for it — Vite splits it into its own chunk, which is why the
worker's `main.js` is 478 kB and Sentry's 1.5 MB sits beside it unloaded.

## Two database roles, and why the boundary is in Postgres

`packages/modules/admin` is what uses the second one, and it is the only thing that does.
`AdminSql` is a **separate service tag** from `SqlClient` rather than a second implementation
of it: a handler asking for `SqlClient` gets the scoped connection, and reaching the other
means naming it. `layerAdminSql` refuses when `ADMIN_DATABASE_URL` is unset instead of falling
back — every other port here has a credential-free layer, and this one must not, because the
only thing to fall back to is the connection that must never read across tenants.

`crossTenant(action, read)` is the only way to use it. It takes what is being done, the
organization it concerns if it concerns one, and **why** — and the reason is neither optional
nor derived, because a log of reads with no reasons in it is one nobody can review. The record
is written first and in the same transaction as the read, so a read that succeeded cannot have
gone unrecorded. It takes the read rather than returning a client for the same reason: a
function handing back `AdminSql` is one somebody calls once and uses forever.

`adminAudit` carries a policy that is never true — `using (false) with check (false)` — so the
application role, which owns the table because it runs the migrations, can neither read nor
write a row of it. A staff trail the application can write to is one a compromised application
can rewrite.

`Staff` is its own type, not an `Identity` with a flag. `Identity` carries an `orgId` because
every other caller acts inside exactly one organization; a flag would let a caller for whom
that field is meaningless reach every handler that takes one, with nothing for the compiler to
say about it.

`Staff` comes from `user.role`, which better-auth's `admin` plugin owns and which has nothing
to do with `member.role` — somebody can own their organization and not be staff, or be staff
and a member of nothing. `StaffResolver` reads it per request rather than trusting a session
payload, so revoking it lands on the next request, and it honours `banned` for the same reason.
"Not signed in" and "signed in but not staff" are one answer, because distinguishing them tells
an anonymous caller that the second state exists.

The plugin's endpoints are mounted on the customer-facing API deliberately: two better-auth
instances over one `user` table is the arrangement where two systems disagree about who
somebody is. A session that somehow became `role: "admin"` there gains user management and no
tenant data, because `apps/server` connects as `vantion`. The controls compose — one decides
who you are, the other what the connection can see.

Admin procedures return **counts, never contents**. Everything they return crosses the tenant
boundary, so the bar is what somebody cannot do their job without: "is their import stuck"
needs the number nine hundred, not nine hundred names, and a test asserts a seeded contact's
address is absent from the response.

`adminAudit.organizationId` carries no foreign key, and that was a bug fixed rather than a
choice made twice. A key refuses an id that never existed, so probing for identifiers produced
a constraint error instead of a row — the one read nobody could explain was the one read nobody
could see. An audit row is a statement about the past; a foreign key makes it one about the
present.

**`apps/server` does not register this module and must not.** The process serving customer
traffic should not hold the credential, which is why the admin application will serve its own
procedures. `docs/admin.md` has the whole argument and is explicit that no such application
exists yet.

`docker compose` bootstraps as `postgres` and never connects as it.
`packages/database/src/roles/init.sql` makes the two roles that matter:

- **`vantion`** is what every application process connects as, and it is
  `NOBYPASSRLS`. A handler that forgets `withOrgScope` therefore reads nothing
  rather than reading everybody.
- **`admin`** holds `BYPASSRLS`, for the cross-tenant surface. Which process may
  cross tenants is decided by Postgres rather than by a lint rule or a reviewer,
  which is the whole reason there are two.

**This was not true until recently, and everything below follows from finding
that out.** The compose file set `POSTGRES_USER: vantion`, which makes it the
bootstrap _superuser_ — so every row-level security policy in this schema was
inert, locally and in the test suite, while `pg_class.relrowsecurity` read true.
`packages/database/test/Role.test.ts` now asserts the connection cannot bypass
and that no policied table is left unFORCEd, because a suite pointed at a
superuser passes every tenancy test while proving nothing.

Switching the role on found **two production bugs** that could not have been
seen before, both the same shape: a worker escape on `using` but not on
`with check`, and an UPDATE is checked by both.

- `Relay.run` claimed a batch and then could not write `relayedAt` back, so
  every pass was refused and **no background job would ever have been
  delivered**.
- A delivery could not clear or increment an endpoint's `consecutiveFailures`,
  so a dead endpoint would never be switched off.

`0012_worker_writes.sql` splits both policies by command: INSERT stays exactly
as strict as it was — a scoped caller writes only its own organization, the
worker only the org-less system rows — and the worker gains the ability to
update what it is already allowed to read.

It also found an **authorisation bug**. `PermissionResolver` read
`memberPermission` straight off the pool with no scope and no organization in
the predicate, so under a policy it returned nothing and every per-member
override was silently ignored — including a **revoke**, which means a permission
somebody had explicitly taken away stayed granted. It now takes one connection,
scopes it, and filters by organization as well: both, never either.

Tests seed through `withOrgScopeFor` rather than writing rows a policy would
refuse. That is not a concession to the tests — it is the product's own write
path, and a fixture that needs more privilege than the application has is a
fixture describing a state the application cannot produce.

Migrations are applied by a script, never at boot — two instances starting together would both
migrate. `packages/database` owns them:

```
DATABASE_URL=postgresql://... pnpm --filter @vantion/database migrate
```

Every migration is idempotent and there is no ledger, so applying the whole set to any database
converges it on the committed schema. `packages/database/test/Migrations.test.ts` is what holds
that property honest — it applies them twice.

## Full rules

`RULES.md` holds the hard repository rules — Effect style, architecture, forms, notifications,
observability, testing, commits. Read it before making changes. `knowledge/README.md` indexes
the per-topic guides.
