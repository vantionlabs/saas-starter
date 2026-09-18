# SaaS starter

Effect v4 monorepo. pnpm workspace + `tsc -b` project references, oxlint + dprint, vitest.

`apps/` holds what deploys — `apps/server` is the Effect API, `apps/web` is the TanStack Start
front end, and each owns its `Dockerfile`.

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

|                                |                                                                    |
| ------------------------------ | ------------------------------------------------------------------ |
| `pnpm dev`                     | API server and the Start client together, in parallel              |
| `pnpm build`                   | deployable artifacts for the database, API and web packages        |
| `pnpm check`                   | `tsc -b` across all project references, then the config files      |
| `pnpm lint`                    | oxlint, incl. Effect type-aware rules and the local `app/*` plugin |
| `pnpm format` / `format:check` | dprint                                                             |
| `pnpm test`                    | vitest across `apps/*` and `packages/*`                            |
| `pnpm e2e`                     | Playwright, driving both servers in a browser                      |
| `pnpm new:module <name>`       | scaffolds `packages/modules/<name>` and registers it               |

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

`.railway/railway.ts` describes the whole Railway project: Postgres, both services, their
Dockerfiles, health check, watch patterns, and the variables wiring them together. `railway
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

Tracing is exported only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set — unset installs no exporter
at all, because one pointed at nothing retries on a schedule and fills the log. `RULES.md` says
not to add manual logging on error paths because spans already carry the context; this is what
makes that true.

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
