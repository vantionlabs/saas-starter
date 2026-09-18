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

`apps/design` deploys nothing. It renders the same components from `@vantion/ui` against
persona fixtures, with no backend, no session and no network — the surface product designers
work on, and the one that pushes to Figma. A persona is a whole tenant's worth of data rather
than a card on a wall: `first-day` where every list is empty, `settled` for the ordinary case,
and `crowded` for the long names and many rows that actually break a layout. The persona
travels in the query string, so a designer can link to exactly the state they mean. `pnpm
design`.

`packages/modules/*` holds one package per feature, `@vantion/module-<name>`. A module owns
its whole vertical: the contract both ends compile against, the RPC handlers, the stores, and
the services behind them.

| Module          | What it owns                                                           |
| --------------- | ---------------------------------------------------------------------- |
| `iam`           | identity, organizations, roles and policies, API keys, the audit trail |
| `contact`       | the worked example of a tenant-owned feature                           |
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

## Read the vendored Effect source before writing Effect code

`repos/effect` is the full Effect monorepo, vendored with `git subtree` at exactly the version
this repo depends on (`effect` in `pnpm-workspace.yaml`, currently `4.0.0-rc.109`). It also
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
