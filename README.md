<p align="center">
  <a href="https://vantion.co">
    <img src="https://raw.githubusercontent.com/vantionlabs/.github/main/profile/banner.png" alt="Vantion Labs" width="100%" />
  </a>
</p>

<h1 align="center">SaaS starter</h1>

<p align="center">
  <b>The agentic engineering workflow, with the product already built.</b><br />
  A multi-tenant B2B SaaS you can deploy today — and the skills, hooks, commands and workflow that take a team from a written idea to a product in production.
</p>

<p align="center">
  <a href="https://github.com/vantionlabs/saas-starter/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/vantionlabs/saas-starter/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/licence-MIT-f4f4f6?style=flat-square" /></a>
  <img alt="257 unit tests" src="https://img.shields.io/badge/tests-257-2EAD33?style=flat-square" />
  <img alt="34 browser tests" src="https://img.shields.io/badge/browser-34-2EAD33?style=flat-square&logo=playwright&logoColor=white" />
</p>

<p align="center">
  <img alt="Effect 4" src="https://img.shields.io/badge/Effect_4-2233f0?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Node 22" src="https://img.shields.io/badge/Node_22-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" />
  <img alt="Postgres" src="https://img.shields.io/badge/Postgres-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-FF4438?style=flat-square&logo=redis&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React_19-149ECA?style=flat-square&logo=react&logoColor=white" />
  <img alt="TanStack Start" src="https://img.shields.io/badge/TanStack_Start-EF4444?style=flat-square&logo=reactquery&logoColor=white" />
  <img alt="Tailwind 4" src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img alt="Base UI" src="https://img.shields.io/badge/Base_UI-18181B?style=flat-square" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white" />
  <img alt="better-auth" src="https://img.shields.io/badge/better--auth-000000?style=flat-square" />
  <img alt="Stripe" src="https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white" />
  <img alt="Resend" src="https://img.shields.io/badge/Resend-000000?style=flat-square&logo=resend&logoColor=white" />
  <img alt="React Email" src="https://img.shields.io/badge/React_Email-000000?style=flat-square&logo=react&logoColor=white" />
  <img alt="BullMQ" src="https://img.shields.io/badge/BullMQ-C82829?style=flat-square" />
  <img alt="OpenTelemetry" src="https://img.shields.io/badge/OpenTelemetry-425CC7?style=flat-square&logo=opentelemetry&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img alt="Railway" src="https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white" />
  <img alt="Figma" src="https://img.shields.io/badge/Figma-F24E1E?style=flat-square&logo=figma&logoColor=white" />
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-D97757?style=flat-square&logo=claude&logoColor=white" />
</p>

---

Most starters give you a codebase. This one also gives you the way of working,
because on an AI-native team that is what decides how fast the codebase moves.

The product half is a multi-tenant B2B SaaS that deploys today: sign-in,
organizations, roles, tenant isolation proven twice, an audit trail, billing, a
public API, background jobs, outbound webhooks. The method half sits beside it in
`.claude/` and `docs/workflow/`: hooks that keep an agent honest, commands that
drive each phase, and the process both exist for.

Both are MIT. Nothing is held back for a paid tier.

## What's in it

**The product** — built, tested, deploys today.

- ✅ **Auth** — password, magic link, email OTP, Google; sessions resolved server-side
- ✅ **Organizations** — members, invitations, seats, org switcher, a personal org per user
- ✅ **Access control** — built-in roles, custom roles, per-member overrides, one permission model
- ✅ **Tenant isolation** — Postgres RLS _and_ `withOrgScope`, proven by browser tests
- ✅ **Audit trail** — who did what, browsable at `/settings/audit`
- ✅ **Billing** — Stripe checkout and portal, subscriptions, plan entitlements in the policy layer
- ✅ **Public API** — `/api/v1` on API keys, OpenAPI document and browsable docs
- ✅ **Background jobs** — a transactional outbox in Postgres, BullMQ for delivery
- ✅ **Outbound webhooks** — signed, retried, deduplicated, auto-disabled when dead
- ✅ **File storage** — presigned uploads to S3 or a local directory, expiring links
- ✅ **Transactional email** — React Email templates through Resend, HTML and text
- ✅ **Realtime** — the same RPC procedures over a websocket, with a worked stream
- ✅ **MCP server** — your own product as tools in an editor, on the same permissions
- ✅ **App shell** — sidebar, command palette, breadcrumbs, empty states, light and dark

**The platform** — what you build the next feature on.

- ✅ **Feature modules** — `pnpm new:module <name>` scaffolds and registers a vertical slice
- ✅ **One design system** — `@vantion/tokens` feeds the web app, NativeWind, Figma and email
- ✅ **A design app** — `apps/design`, the same components on persona fixtures, no backend
- ✅ **Figma both ways** — generate a library and screens from code, pull refinements back
- ✅ **Tests that gate** — 257 unit, 34 browser, testcontainers Postgres, all in CI
- ✅ **Operations** — `/health`, `/ready`, OpenTelemetry and error tracking in all
  three processes, web vitals in the browser, a Dockerfile per app, Railway IaC
  covering all of it

**The method** — committed in `.claude/` and `docs/workflow/`.

- ✅ **Hooks** — format, type-check, lint and the repo's rules, on every agent edit
- ✅ **Commands** — `/product-*` for each phase, `/figma-*` for the design loop
- ✅ **Skills** — the workflow as a skill, plus vendored `impeccable` for design and
  the marketing skills for launch; installable as a plugin
- ✅ **Vendored sources** — `repos/effect` so an agent reads real signatures, not recall

### What that buys you

|                                               |                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Week one is a feature, not a login screen** | The four weeks a B2B product usually spends on auth, tenancy, roles and billing are already spent.                                        |
| **An agent that is checked, not trusted**     | Every edit runs the gate. Every merge runs the browser. The loop closes without you reading each diff.                                    |
| **One contract, every surface**               | Web, mobile, the public API and an MCP server compile against the same types. A breaking change is a compile error, not a support ticket. |
| **A design process, not a handoff**           | Designers work on the real components, in `apps/design` and in Figma, and what they change comes back as tokens instead of screenshots.   |
| **Multi-tenancy you can defend**              | Isolation is enforced twice and demonstrated by two real users in a browser, which is what a security review asks for.                    |
| **Nothing held back**                         | MIT, no paid tier, no telemetry, and no vendor account needed to run the whole thing locally.                                             |

## Why Effect

Because it is the most agent-legible way to write TypeScript, and on an AI-native
team that is a throughput argument rather than a taste one.

**Failures are in the signature.** `Effect<Contact, Forbidden, CurrentUser>` says
what it returns, how it can fail, and what it needs. An agent cannot quietly
swallow an error it did not know about, because the compiler names it. A
reviewer reading a diff sees the failure modes without opening the body.

**Dependencies are in the type, not in the imports.** Forgetting to provide
something is a compile error rather than a `undefined is not a function` at three
in the morning. It is also what makes the module layout enforceable: an
application composes `IamModule`, and what that module still _needs_ —
`SqlClient`, `Mailer`, `RateLimiter` — is written down where the checker can see
it.

**Swapping a boundary is a one-line change.** Every external service here is a
service with two layers, one needing no credentials: Resend or the log, BullMQ or
memory, Stripe or refusal. That is why a fresh clone can follow a magic link,
deliver a webhook and run every test with no accounts at all, and why tests
replace the boundary instead of mocking a module.

**One idiom covers the stack.** HTTP, SQL, streams, retries, concurrency,
scheduling and the RPC layer are the same library, so there is one set of
conventions for an agent to learn and far less surface to guess at. It is also
what makes vendoring pay: `repos/effect` is _one_ dependency, and having it in
the tree gives an agent ground truth for nearly everything it will write.

**Tests are deterministic by construction.** Logical clocks, layers swapped at
the edges, and no sleeps. That is what lets a suite of 257 be a gate an agent
runs between every slice, not something a human runs before lunch.

The cost is honest: Effect v4 is a release candidate, the learning curve is real,
and `RULES.md` exists because the idioms are worth stating rather than absorbing.
See **Status** below.

## One repo, the whole product

A product is not only its application. The pieces that usually scatter across
four repositories and two agencies live here, sharing one design system — so a
colour changes in `packages/tokens` and moves the app, the marketing site, the
emails and the Figma library at once.

|                  |                                                                                                          |           |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| `apps/server`    | the Effect API: RPC, the public `/api/v1`, auth, websockets                                              | **built** |
| `apps/web`       | the product itself, TanStack Start                                                                       | **built** |
| `apps/worker`    | the outbox relay and the jobs it feeds                                                                   | **built** |
| `apps/design`    | the product's screens on persona fixtures, no backend — what designers work on, and what pushes to Figma | **built** |
| `apps/marketing` | the landing page and marketing site                                                                      | planned   |
| `apps/brand`     | the brand kit: typography, colour, voice, motion, ad creative, email footers, business cards             | planned   |
| `apps/mobile`    | Expo, sharing the contract and the tokens                                                                | planned   |

Underneath, `packages/tokens` is the single source the whole lot reads —
TypeScript, not CSS, because only one of its consumers speaks CSS:

```
packages/tokens ──┬──▶ packages/ui        the web design system
                  ├──▶ packages/emails    React Email, converted to hex
                  ├──▶ Figma variables    via /figma-tokens
                  └──▶ NativeWind         when apps/mobile lands
```

A test asserts every colour survives conversion to sRGB without clipping. It
earned itself on the first run: one token was outside the gamut, so what rendered
had never been what was written.

## The flow

Four phases, each with a command that drives it and a file it reads. The
artefact one phase produces is the input the next one consumes, which is the
whole point: nothing is re-derived from a conversation somebody half remembers.

```
 discovery  ──▶   design   ──▶    build    ──▶    ship
     │               │               │               │
/product-discover /product-prototype /product-build  /product-ship 
     │               │               │               │
a written        real screens    vertical slices  deployed, with
riskiest         in apps/design, each green       the isolation
assumption       pushed to Figma  before the      tests still
and a cut        for designers    next starts     passing
feature list     to refine
```

| Phase         | Produces                                                      | Refuses to advance until           |
| ------------- | ------------------------------------------------------------- | ---------------------------------- |
| **Discover**  | the riskiest assumption, written down, and a cut feature list | the assumption is written          |
| **Prototype** | real screens against the real shell, no new tables            | no migration was needed            |
| **Build**     | vertical slices — schema, handler, screen, tests              | each slice passes the whole gate   |
| **Ship**      | deployed, documented, with tenant isolation proven            | nothing on the checklist is untrue |

The gates are the method; everything else is detail. `docs/workflow/` has each
phase written out, and `STATE.md` is where a phase records what it did. That
file is read back at the start of the next session, because product work outlives
any context window.

## Docs to design to dev

The path an idea takes, and where each artefact lives.

**1 · Written first.** Discovery produces prose, not tickets: who this is for,
what they do instead today, and the one assumption that makes the rest pointless
if it is false. It lands in `docs/workflow/01-discovery.md`.

**2 · Designed against the real components.** `apps/design` renders the product's
own screens — the same `@vantion/ui` the app uses — fed by **persona fixtures**
instead of a backend. A persona is a whole tenant's worth of data, chosen so the
screens are seen under the conditions that break them:

| Persona     | What it shows                                                             |
| ----------- | ------------------------------------------------------------------------- |
| `first-day` | every list empty — the state most designs forget                          |
| `settled`   | the ordinary case                                                         |
| `crowded`   | forty-character names and two dozen rows — the state that breaks a layout |

The persona travels in the query string, so a designer can send a link to exactly
the state they mean rather than describing it. `pnpm design`.

**3 · Into Figma, as a design system.** `/figma-tokens` syncs `@vantion/tokens`
into a file's variables; `/figma-screen` assembles a screen _from those
variables_ rather than pasting hex. Designers refine there, and `/figma-pull`
brings the change back — deciding first whether it is a **token**, a
**component**, or a **screen**, because those are three different files and
getting it wrong is how a one-off colour ends up hardcoded in a route.

**4 · Built in slices.** `pnpm new:module <name>` scaffolds a feature package and
registers it. Each slice is schema, handler, screen and tests, and does not start
until the previous one passes `pnpm check && pnpm lint && pnpm test`, plus
`pnpm e2e` when it touched a route.

**5 · Shipped.** `railway config plan` shows the diff before `railway config
apply` performs it, so a deployment is reviewable the way a pull request is.

## The agent layer

`.claude/` is committed, so a fresh clone gets it. The hooks are plain Node
scripts with no network access and no `npx`: read them before you trust them,
which is the point of shipping them in the tree rather than asking you to
install something. The one exception is named as such — the design pass calls
the vendored `impeccable` launcher, which fetches its own binary the first time
it runs. **Delete `.claude/settings.json` to turn all of it off.**

### Hooks

| Event                  | What it does                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `SessionStart`         | prints the pinned Effect version, whether `repos/` is vendored, whether Postgres is up, and the current phase |
| `PreToolUse` on Bash   | refuses force pushes, `--no-verify`, hand-edits to `repos/`, and an `rm -rf` naming a root                    |
| `PostToolUse` on edits | `dprint`, `oxlint`, and `tsc -b` scoped to the one package that changed — about a second, warm                |
| `PostToolUse` on edits | the part of `RULES.md` a regex can decide                                                                     |

They report by exiting 2 and writing to stderr, because a `PostToolUse` hook's
stdout goes to the debug log and the model never sees it. And `check-rules`
enforces six rules rather than twenty: **every one holds across the whole
repository today**, asserted by a test that runs the hook over every tracked
source file. A check that fires on existing code is one somebody disables in its
first hour, taking the working ones with it.

### Commands

| Command              | For                                                          |
| -------------------- | ------------------------------------------------------------ |
| `/product-discover`  | the assumption, the evidence, the cut list                   |
| `/product-prototype` | real screens, no migrations                                  |
| `/product-build`     | vertical slices against the repo's own conventions           |
| `/product-ship`      | the checklist, the Railway plan, the changelog               |
| `/figma-tokens`      | sync the design system's variables into a Figma file         |
| `/figma-screen`      | push a screen from `apps/design`, built from those variables |
| `/figma-journey`     | draw a user journey into FigJam                              |
| `/figma-pull`        | bring a designer's change back into the right file           |

### Skills

`.claude/skills/product-development` is the method as a skill: the four phases,
their gates, and what to cut first when the list will not fit.

Two third-party skill sets are vendored beside it rather than named in a
paragraph you have to go and install, so a fresh clone has the design and launch
halves of the work as well as the engineering one:

| Skill                                                                                                                                          | For                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`impeccable`](https://impeccable.style)                                                                                                       | the design work itself — shape, critique, polish, audit |
| `draft-content`, `campaign-plan`, `brand-review`, `competitive-brief`, `email-sequence`, `seo-audit`, `content-creation`, `performance-report` | launch: positioning, copy, campaigns, reporting         |

Both are Apache-2.0 and unmodified except for one link path; [NOTICE](NOTICE)
records them. `impeccable`'s launcher fetches its own binary on first use, which
is why `.claude/skills/*/scripts/bin/` is gitignored rather than committed.

`.claude-plugin/` publishes the commands and the repo's own skill, so the
workflow can be taken **without** taking the starter:

```
/plugin marketplace add vantionlabs/saas-starter
/plugin install vantion-product-development@vantion
```

The hooks stay out of the plugin deliberately: they run _this_ repository's
formatter, linter and type-checker, and a plugin's paths resolve somewhere else.

### What keeps an agent honest

Three things, and they matter more than the hooks:

**`repos/` is vendored.** The whole Effect monorepo, at exactly the version
installed, so an agent reads a real signature instead of recalling a v3 one.
`AGENTS.md` states the precedence: `repos/effect`, then `RULES.md`, then
`knowledge/`, then recall, which is never authoritative. Writing one HTTP client in this
repo took four passes against that source; every wrong recall would have compiled
a year ago.

**Tenant isolation is tested end to end.** `e2e/tests/tenancy.spec.ts` signs up
two real users and proves neither sees the other's rows. Unit tests cover RLS and
`withOrgScope` separately; only that file shows the whole stack, session to SQL,
keeping two people apart.

**The gate includes the browser.** A green compiler is not evidence the thing
runs. Running the full gate between slices has already caught a Node subpath
import that `tsc` resolved and Node could not, a lint fix that satisfied the
linter while breaking Playwright, and an export map that type-checked perfectly
while resolving to nothing at run time.

## The product, in detail

**Identity** — email and password, magic link, email OTP, and Google, via
[better-auth](https://better-auth.com). Every new user gets a personal
organization on creation, so there is no orgless state anywhere else in the
system to represent or handle.

**Organizations and access control** — members, invitations, the built-in
`owner`/`admin`/`member` roles, plus custom roles and per-member overrides
editable in the UI. One permission model, declared once in
`packages/modules/iam/src/identity/Permission.ts`, is what both our RPC policies and
better-auth's own endpoint checks are built from, so the two cannot quietly
disagree about who may do what.

**Tenant isolation, twice** — Postgres row-level security on tenant tables, and
`withOrgScope` around the queries that touch them. Neither is trusted alone.

**An audit trail** — writes record who did what, browsable at
`/settings/audit`.

**A public API** — `/api/v1`, authenticated by API key rather than by session,
with an OpenAPI document at `/api/v1/openapi.json` and browsable docs at
`/api/v1/docs`. It runs over the same stores as the RPC, so a handler is never
written twice. Keys are created and revoked at `/settings/api-keys`.

**A front end that is already an app** — sidebar, org switcher, command palette,
breadcrumbs, error boundaries, empty states, light and dark. shadcn components
on [Base UI](https://base-ui.com). Server-rendered auth: `beforeLoad` resolves
the session before the page renders, so protected routes never flash.

**Operations** — `/health` and `/ready`, OpenTelemetry tracing from both the API
and the worker, error tracking behind `SENTRY_DSN`, client errors and web vitals
from the browser behind `VITE_SENTRY_DSN`, a Dockerfile per app, and Railway
infrastructure as code that describes the database, the queue and all three
services.

Both boundaries follow the same rule as every other one here: unset, no SDK is
loaded and nothing is reported. Error tracking is a logger rather than a call at
each failure site — `RULES.md` forbids manual logging on error paths, so the
places that would have called a tracker by hand do not exist, and one wiring
point per process catches what remains.

## Getting started

You need Node 22+, pnpm, and Postgres. (`docker compose up -d` gives you the
database if you would rather not run one.) A Nix flake is included but optional.

```bash
pnpm install
cp .env.example .env
```

Fill in `AUTH_SECRET` — `openssl rand -base64 32` — and point `DATABASE_URL` at
your database. Everything else has a working local default.

Apply the schema — the migration runner reads the same `.env` — then start both
servers:

```bash
pnpm --filter @vantion/database migrate
```

```bash
pnpm dev
```

The API is on `http://localhost:3000` and the front end on
`http://localhost:5173`. Sign up with an email and password — nothing blocks
sign-in on verification, so you are straight in with your own organization.

Email needs no setup to try. Without `RESEND_API_KEY`, the mailer writes each
message to the server log instead of sending it, so a magic link is a link you
can follow out of your terminal, and every auth flow works on a fresh clone.
Set the key when you want mail to actually leave.

## Making it yours

**Rename.** The package scope is `@vantion/*` and appears in imports throughout.
One pass does it:

```bash
grep -rl '@vantion/' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=repos . | xargs perl -pi -e 's|\@vantion/|\@acme/|g'
```

Then the loose ends: `name` in each `package.json`, the database name in
`docker-compose.yml` and `.env`, `OTEL_SERVICE_NAME`, `EMAIL_FROM`, and the repo
and project name in `.railway/railway.ts`.

**Delete the example.** `Contact` is a worked example of a tenant-owned entity
and nothing else depends on it being contacts specifically. It is these files,
plus its rows in `Permission.ts` and its route in the sidebar:

```
packages/modules/contact/src/ContactRpc.ts
packages/modules/contact/src/
apps/web/src/atom/contact-atoms.ts
packages/ui/src/contact/
apps/web/src/routes/_protected/contacts.tsx
```

Read it before you delete it. It is the shortest description of how a feature
is put together here.

**Adjust permissions.** `packages/modules/iam/src/identity/Permission.ts` declares the
resources and actions, and `grantsFor` says which role gets what. The
`organization`, `member`, `invitation` and `team` entries are better-auth's own
vocabulary and should stay as they are; add yours alongside `contact`. The
picker in the UI and better-auth's access control are both generated from this
declaration, so adding a resource is a one-line change that shows up in both.

## Adding a feature

A tenant-owned feature is five files and a migration, in this order:

1. **A migration** in `packages/database/src/migrations/`. Give the table an
   `organizationId`, and copy the row-level-security policy from `0002_rls.sql`.
   Migrations are idempotent and there is no ledger — applying the whole set to
   any database converges it on the committed schema, and
   `packages/database/test/Migrations.test.ts` keeps that honest by applying
   them twice.

2. **The contract** in `packages/domain/`, an `RpcGroup` of `Rpc.make` calls
   ending in `.middleware(AuthMiddleware)`. Merge it into `AppRpcs` — both ends
   read that list, so a group added to one and not the other is a compile error
   rather than a call that fails at runtime.

3. **A store** in `apps/server/`, wrapping its queries in `withOrgScope`.

4. **The handlers**, `YourRpcs.toLayer(...)`, guarded with `withPolicy` and
   `permission(...)`. Provide the layer in `apps/server/src/Main.ts`.

5. **Atoms** in `apps/web/src/atom/`. Reads are declared by naming the RPC —
   `AppRpc.query("ListThings", undefined, { reactivityKeys })` — and writes stay
   hand-written as `AppRpc.runtime.fn`, which keeps "what does this invalidate"
   next to the write rather than at every call site.

Only step 4 is where you decide anything about authorization, and only step 1 is
where you decide anything about isolation. The rest is transport.

To expose it publicly as well, add it to `packages/domain/src/api/v1/Api.ts` and
implement it in `apps/server/src/api/v1/Handlers.ts` over the same store. Read
`Wire.ts` first — it is the frozen contract and it explains what may change in
it.

## Commands

|                                |                                                     |
| ------------------------------ | --------------------------------------------------- |
| `pnpm dev`                     | API, front end and worker together                  |
| `pnpm design`                  | the design app, on persona fixtures                 |
| `pnpm new:module <name>`       | scaffold a feature package and register it          |
| `pnpm build`                   | deployable artifacts for every package              |
| `pnpm check`                   | `tsc -b` across all project references              |
| `pnpm lint`                    | oxlint, including Effect type-aware and local rules |
| `pnpm format` / `format:check` | dprint                                              |
| `pnpm test`                    | vitest across `apps/*` and `packages/*`             |
| `pnpm e2e`                     | Playwright, driving both servers in a browser       |
| `pnpm vendor`                  | re-vendor the upstream source under `repos/`        |

Postgres-backed tests skip without a database. Either `docker compose up -d`, or
point at an existing instance with `TEST_DB_URL=postgresql://...`.

`pnpm e2e` runs the browser suite in `e2e/`. It needs no setup and no running
app: it starts its own Postgres on a free port, applies the migrations, runs
both servers on ports of their own, and cleans up after itself. Run
`pnpm --filter @vantion/e2e install-browsers` once first.

## Deploying

`pnpm build` produces the API bundled to `apps/server/build/bundle/main.js`, the
web app's Nitro output in `apps/web/.output/`, and the migration runner with its
`.sql` files beside it. The API is bundled rather than merely compiled because
the workspace packages export TypeScript source, which `tsc` output alone would
import as `.ts` files Node cannot load.

Each app has its own Dockerfile, built from the repo root:

```bash
docker build -f apps/server/Dockerfile -t acme-api .
```

Migrations are applied by a script, never at boot, because two instances starting
together would both migrate. On Railway that is the `preDeployCommand`.

`.railway/railway.ts` describes the whole project: Postgres, Redis, the API, the
worker and the web app, their variables and health checks. `railway config plan` shows the diff and
`railway config apply` performs it, so a deployment is reviewable the way a pull
request is. Change `REPO`, the `environments` map and the project name; secrets
stay in Railway's dashboard, held by `preserve()`.

Branch and domain come from the environment being planned against, via
`ctx.isEnvironment`, so production and staging can differ without the file
depending on whoever runs it. `process.env` is readable in that runner, but
reaching for it would cost the property that makes a plan worth reviewing: two
people planning the same environment get the same plan.

It cannot create the domains, though — the runner rejects a `domains` entry
outright, so the two public services need theirs added in the dashboard. Setting `DOMAIN`
is what makes every address in the file name them ahead of time rather than
falling back to a `RAILWAY_PUBLIC_DOMAIN` that does not resolve yet.

**One constraint to know before you pick hostnames.** The browser talks to the
API directly, so the two are separate origins and the session cookie only flows
between them if they are _same-site_: both under one parent domain, with
`AUTH_COOKIE_DOMAIN=.example.com`. That parent cannot be a public suffix, and
`up.railway.app` is on the list — so **two generated Railway hosts can never
share a session**. Splitting these services there needs a domain of your own,
`app.example.com` and `api.example.com`.

Tracing exports only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Leaving it unset
installs no exporter at all, because one pointed at nothing retries on a
schedule and fills the log.

## Reading further

`AGENTS.md` is the map: layout, commands, and the deployment story, written for
whoever (or whatever) picks the repo up cold. `RULES.md` holds the hard rules on
Effect style, architecture, forms, observability and testing; read it before
changing much. `knowledge/README.md` indexes the per-topic guides.

`docs/workflow/` is the method, written out phase by phase, and `docs/figma.md`
is the design workflow and its one account caveat.

`repos/` vendors the Effect and effect-form sources at exactly the versions this
repo depends on. Effect v4 is a release candidate whose APIs moved recently, so
read the real signature there instead of trusting recall, including your own.

## Status

**Effect v4 is a release candidate.** This repo pins one exact version
(`4.0.0-rc.109`, in `pnpm-workspace.yaml`) and vendors its source under `repos/`
so the APIs you read are the APIs you have. That is a stronger position than
most, but it is still an RC: `effect/unstable/*` means unstable, and a bump is a
deliberate step rather than a background one.

**Some of this is newer than the rest.** Auth, organizations, access control,
tenant isolation and the public API came from production work and have been
exercised. Billing, jobs, webhooks, the design app and the Figma path are newer,
tested but not yet weathered. `apps/marketing`, `apps/brand` and `apps/mobile`
are named in the table above because that is the shape, not because they exist.

## Roadmap

What is missing, in the order it is likely to land. All of it is tracked in the
open, and none of it is waiting behind a paid tier.

|           | What                                    | Why it is not here yet                                                                                                                                   |
| --------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Then**  | `packages/core` + `apps/mobile`         | The shared hooks and logic, then Expo and NativeWind against the same contract and the same tokens.                                                      |
| **Then**  | `apps/marketing` and `apps/brand`       | The landing page and the brand kit — typography, colour, voice, motion, email footers.                                                                   |
| **Next**  | An assistant, and evals                 | The toolkit and its approval gate exist and an MCP client can drive them; what is missing is a language model in the product, and a baseline gate in CI. |
| **Then**  | A spec template for the discovery phase | `/product-discover` describes the thinking; what is missing is the artefact it produces and `/product-build` consumes.                                   |
| **Later** | SSO and SAML                            | The heaviest remaining item, and the one enterprise deals actually ask for.                                                                              |
| **Later** | An admin panel                          | Cross-tenant by nature, so it steps outside the RLS guarantee everything else relies on and needs its own audited path.                                  |

## What it deliberately does not do

Distinct from the roadmap above: these are choices rather than gaps.

- **No i18n.** Strings are English and inline. Cheap to add early and expensive
  to retrofit, so this is a stated choice rather than an oversight.
- **No compliance tooling.** No data export, right-to-erasure or retention
  policies. The audit trail is the raw material for them, not a substitute.
- **No arithmetic or authorisation by model.** There is no AI in the request
  path deciding who may do what.

## Contributing

Issues and pull requests are welcome, especially tests that catch a real
failure. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md);
security reports go to hello@vantion.co, see [SECURITY.md](SECURITY.md).

## Licence

MIT. See [LICENSE](LICENSE). The vendored sources under `repos/` keep their own
licences, and [NOTICE](NOTICE) records them. Built by
[Vantion Labs](https://vantion.co); if you want help getting a B2B SaaS product
into production, [talk to the founder](https://vantion.co/book-a-call).
