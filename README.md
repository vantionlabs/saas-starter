<p align="center">
  <a href="https://vantion.co">
    <img src="https://raw.githubusercontent.com/vantionlabs/.github/main/profile/banner.png" alt="Vantion Labs" width="100%" />
  </a>
</p>

<h1 align="center">SaaS starter</h1>

<p align="center">
  <b>For AI-forward software and design engineers who ship in days and still have to pass a security review.</b><br />
  A multi-tenant B2B SaaS that deploys today, and the skills, subagents, hooks and workflow that drive an agent through it safely.
</p>

<p align="center">
  <a href="https://github.com/vantionlabs/saas-starter/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/vantionlabs/saas-starter/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/licence-MIT-f4f4f6?style=flat-square" /></a>
  <img alt="518 unit tests" src="https://img.shields.io/badge/tests-518-2EAD33?style=flat-square" />
  <img alt="67 browser tests" src="https://img.shields.io/badge/browser-67-2EAD33?style=flat-square&logo=playwright&logoColor=white" />
</p>

<p align="center">
  <img alt="Effect 4" src="https://img.shields.io/badge/Effect_4-2233f0?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white" />
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
  <img alt="OpenRouter" src="https://img.shields.io/badge/OpenRouter-6566F1?style=flat-square" />
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-D97757?style=flat-square&logo=claude&logoColor=white" />
</p>

---

An agent can write a tenant-scoped query in seconds. It can also write one that
misses `withOrgScope`, and that one reads every customer's rows — compiles,
passes review, and is a breach.

**That gap is what this repository is about.** Generating code quickly is the
part that already works. Handing the result to a security review is not, and
being careful is not what fixes it: what fixes it is making the dangerous thing
hard to do and the safe thing the path of least resistance.

Here that means the application connects as a Postgres role that **cannot**
bypass row-level security, so a forgotten scope reads nothing rather than
everything. A `tenancy-review` subagent has to name the request that would
exploit each finding it reports. Hooks refuse a commit that breaks the rules,
the gate a slice passes includes browser tests, and the Effect source is
vendored under `repos/` so an agent reads real signatures instead of inventing
them.

The product half deploys today: sign-in, organizations, roles, tenant isolation
proven twice, an audit trail, billing, a public API, background jobs, outbound
webhooks, SSO and directory provisioning. The method half sits beside it in
`.agents/` and `docs/workflow/` — skills carrying the rules, subagents reviewing
what a compiler cannot, and commands driving each phase.

**Scalable here is structural, not a benchmark.** One handler is served four
ways — RPC, a versioned public API, an agent toolkit and an MCP server — and
never written twice. Background work goes through a transactional outbox, so a
job cannot fire for a write that rolled back. A feature is a module you can
delete in one commit.

Both are MIT. Nothing is held back for a paid tier.

## Who this is for

**AI-forward software engineers.** You are already driving agents through real
code. What slows you down is not generation, it is the review — and the parts
where a plausible-looking change is expensive: tenancy, billing, auth, jobs,
webhooks. Those are built, tested, and explained well enough to change rather
than work around. The rules an agent needs are written as skills instead of
rediscovered every session.

**Design engineers**, and this is the half most starters have nothing for.
`apps/design` renders every product screen, the marketing site and the brand kit
from the same components the real apps ship — with no backend, no session and no
network. Three personas: a first day where every list is empty, an ordinary
tenant, and a crowded one whose long names break layouts. Tokens are one
TypeScript file the stylesheet, the native app, the emails and Figma all read, so
a colour changes in one place. You work on the real thing without running the
real thing, and `impeccable` — the design skill this repository vendors — is
wired in along with its four review subagents.

**Founders and solo builders** who need a product rather than a stack, and would
rather spend the first month on what makes theirs different.

It assumes TypeScript. It does **not** assume you know Effect — `docs/` and the
skills exist because most people arrive not knowing it, and the worked examples
are there to be copied.

## What's in it

**The product** — built, tested, deploys today.

- ✅ **Auth** — password, magic link, email OTP, Google; sessions resolved server-side
- ✅ **Single sign-on** — OIDC and SAML per organization, routed by email domain, DNS-verified
- ✅ **Admin panel** — its own app on its own database role, every cross-tenant read recorded
- ✅ **Two-factor** — TOTP with backup codes, optional for everyone, enforceable for staff
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
- ✅ **An assistant** — over your own data, with a screen, and writes it must ask for
- ✅ **Evals** — a test set, deterministic checks and a baseline the build fails on
- ✅ **App shell** — sidebar, command palette, breadcrumbs, empty states, light and dark

**The platform** — what you build the next feature on.

- ✅ **Feature modules** — `bun run new:module <name>` scaffolds and registers a vertical slice
- ✅ **One design system** — `@vantion/tokens` feeds the web app, the phone, Figma and email
- ✅ **A design app** — one canvas for product, marketing and brand, on fixtures, no backend
- ✅ **Figma both ways** — generate a library and screens from code, pull refinements back
- ✅ **Tests that gate** — 380 unit, 45 browser, an eval set with a baseline, all in CI
- ✅ **Hygiene that gates** — dead code, version drift and secrets, in the same CI job
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

Because it is the most agent-legible way to write TypeScript, and on an
AI-forward team that is a throughput argument rather than a taste one.

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
the edges, and no sleeps. That is what lets a suite of 322 be a gate an agent
runs between every slice, not something a human runs before lunch.

The cost is honest: Effect v4 is a release candidate, the learning curve is real,
and `RULES.md` exists because the idioms are worth stating rather than absorbing.
See **Status** below.

## One repo, the whole product

A product is not only its application. The pieces that usually scatter across
four repositories and two agencies live here, sharing one design system — so a
colour changes in `packages/tokens` and moves the app, the marketing site, the
emails and the Figma library at once.

|                  |                                                                                                              |           |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| `apps/server`    | the Effect API: RPC, the public `/api/v1`, auth, websockets                                                  | **built** |
| `apps/web`       | the product itself, TanStack Start                                                                           | **built** |
| `apps/worker`    | the outbox relay and the jobs it feeds                                                                       | **built** |
| `apps/design`    | one canvas for all three surfaces on fixtures, no backend — what designers work on, and what pushes to Figma | **built** |
| `apps/marketing` | the marketing site: multi-page, server-rendered, pricing read from the product's own plans                   | **built** |
| `apps/brand`     | the brand kit, generated from the tokens: colour, type, voice, motion, email footer, social card             | **built** |
| `apps/mcp`       | the toolkit over stdio: your product as tools in an editor                                                   | **built** |
| `apps/mobile`    | Expo and NativeWind over the same contract, queries and tokens                                               | **built** |

Underneath, `packages/tokens` is the single source the whole lot reads —
TypeScript, not CSS, because only one of its consumers speaks CSS:

```
packages/tokens ──┬──▶ packages/ui        the design system, all three surfaces
                  ├──▶ packages/emails    React Email, converted to hex
                  ├──▶ Figma variables    via /figma-tokens
                  └──▶ NativeWind         when apps/mobile lands

packages/core ────┬──▶ apps/web           the RPC client and every query
                  └──▶ apps/mobile        the same ones, when it lands

packages/ui ──────┬──▶ apps/web           the product
                  ├──▶ apps/marketing     the site's sections
                  ├──▶ apps/brand         the kit's sections
                  └──▶ apps/design        all of them, on fixtures → Figma
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

| Phase         | Produces                                                     | Refuses to advance until           |
| ------------- | ------------------------------------------------------------ | ---------------------------------- |
| **Discover**  | a written riskiest assumption, and a spec with a slice table | the assumption is written          |
| **Prototype** | real screens against the real shell, no new tables           | no migration was needed            |
| **Build**     | vertical slices — schema, handler, screen, tests             | each slice passes the whole gate   |
| **Ship**      | deployed, documented, with tenant isolation proven           | nothing on the checklist is untrue |

The gates are the method; everything else is detail. `docs/workflow/` has each
phase written out, and two files carry a product between sessions. `SPEC.md` is
what the work **is** — filled in from `SPEC.md.example` at the end of discovery,
committed, and read by `/product-build` instead of re-deriving scope from a
conversation nobody can open again. `STATE.md` is where the work **got to**,
gitignored, and read back at the start of every session because product work
outlives any context window.

## Docs to design to dev

The path an idea takes, and where each artefact lives.

**1 · Written first.** Discovery produces prose, not tickets: who this is for,
what they do instead today, and the one assumption that makes the rest pointless
if it is false. It lands in `docs/workflow/SPEC.md`, whose §5 turns the surviving
feature list into slices — each with the module that owns it, whether it is
tenant-owned, and what demonstrates it. That column is what commits a slice to a
row-level security policy and a tenancy test, so leaving one blank is a decision
nobody took. How many rows fit is a measured question, not a felt one:
`01-discover.md` has what each module in this repository actually cost.

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
the state they mean rather than describing it. `bun run design`.

**3 · Into Figma, as a design system.** `/figma-tokens` syncs `@vantion/tokens`
into a file's variables; `/figma-screen` assembles a screen _from those
variables_ rather than pasting hex. Designers refine there, and `/figma-pull`
brings the change back — deciding first whether it is a **token**, a
**component**, or a **screen**, because those are three different files and
getting it wrong is how a one-off colour ends up hardcoded in a route.

**4 · Built in slices.** `bun run new:module <name>` scaffolds a feature package and
registers it. Each slice is schema, handler, screen and tests, and does not start
until the previous one passes `bun run check && bun run lint && bun run test`, plus
`bun run e2e` when it touched a route.

**5 · Shipped.** A pull request shows the deployment's plan, and a merge applies
it once CI passes, so a deployment is reviewable the way a pull request is.

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
| `/product-ship`      | the checklist, the deploy plan, the changelog                |
| `/figma-tokens`      | sync the design system's variables into a Figma file         |
| `/figma-screen`      | push a screen from `apps/design`, built from those variables |
| `/figma-journey`     | draw a user journey into FigJam                              |
| `/figma-pull`        | bring a designer's change back into the right file           |

### Skills

`.agents/skills/product-development` is the method as a skill: the four phases,
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
is why `.agents/skills/*/scripts/bin/` is gitignored rather than committed.

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

Six stages, in order. Each one ends somewhere you can stop, and nothing later
depends on you having read the prose in between.

Everything below works with **no accounts anywhere**. Stripe, Resend, S3, Sentry,
Redis and a model provider are all optional, and each degrades to something
honest rather than refusing to start — that is a rule the repository enforces on
itself, not a demo mode.

### 1 · Running

You need **Bun 1.4+** and Postgres. `docker compose up -d` gives you Postgres,
Redis and Jaeger if you would rather not run them yourself. A Nix flake is
included and optional.

```bash
bun install
cp .env.example .env
```

Fill in one value — `AUTH_SECRET`, from `openssl rand -base64 32` — and point
`DATABASE_URL` at your database. Everything else has a working local default.

```bash
bun run services      # postgres, redis, jaeger
bun run db:migrate
bun run dev           # API :3000, web :5173, worker
```

> **An older clone?** `docker compose down -v` once first. The Postgres container
> now bootstraps as `postgres` and provisions the application's role separately,
> and the script that does it only runs when the volume is first created.

### 2 · Seeing the product

Sign up at `http://localhost:5173` with any email and password. Nothing blocks
sign-in on verification, so you land straight in your own organization and the
setup wizard.

Then fill it with something worth clicking through:

```bash
bun run seed
```

Three organizations mirroring the design personas, with contacts, members,
custom roles, API keys, an audit trail, files, a subscription, webhook endpoints
and a deliberately stuck outbox. Everyone's password is `seedpassword`, and
`staff@vantion.co` is staff, so `bun run admin` opens the cross-tenant panel
without a SQL prompt.

An empty application proves nothing: every list is its empty state, no screen is
seen under load, and the admin panel has no tenant to open. The seed is what
found a real hydration bug that only appeared with data in it.

**Mail needs no setup.** Without `RESEND_API_KEY` the mailer writes each message
to the server log, so a magic link is a link you can follow out of your terminal
and every auth flow works on a fresh clone.

### 3 · The design surface

```bash
bun run design
```

Every product screen, the marketing site and the brand kit, rendered from the
same `@vantion/ui` components the real apps use — with no backend, no session and
no network. The persona travels in the query string, so you can link somebody to
exactly the state you mean: `?persona=crowded` is the one with long names and two
dozen rows, which is the state that actually breaks a layout.

Design decisions live in three places, and which one a change belongs in is the
whole discipline:

| Change                         | Where                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| A colour, a radius, a duration | `packages/tokens/src/tokens.ts` — one source; the stylesheet, NativeWind, the emails and Figma all read it |
| How a component looks anywhere | `packages/ui/src/`                                                                                         |
| What one screen shows          | the route in `apps/web`, or the screen in `apps/design`                                                    |

A one-off colour hardcoded in a route is the failure this arrangement exists to
prevent. `bun run brand` renders the brand kit, and every swatch on it is
generated — a brand document maintained by hand is out of date the first time
somebody changes a colour, and then it is worse than nothing because people still
believe it.

**Two commands to run once, when you start designing your own product.**
`impeccable init` interviews you and writes `PRODUCT.md`; once you have a few
screens, `impeccable document` derives `DESIGN.md` from what the code actually
looks like. Every other design command reads those two before doing work.

Neither file ships here, and that is deliberate — they are one product's answers
to questions only its own team can answer, so a filled-in pair would hand every
generated repository somebody else's. `docs/workflow/00-overview.md` has the full
table of what to run once and at which phase, including the marketing skills,
which need no setup at all.

`docs/figma.md` covers the round trip. It needs a Figma seat that can write, and
says so rather than letting you find out.

### 4 · The backend

`apps/server/src` is three files. That is the measure of whether this is working:
an application composes modules and owns almost nothing itself.

A feature is a **module** — `packages/modules/<name>` — that owns its whole
vertical: the contract both ends compile against, the RPC handlers, the stores,
and the services behind them. `contact` is the worked example and is meant to be
read end to end, then deleted.

Two properties hold everything else up, and both are worth ten minutes before you
write a query:

- **Tenant isolation is enforced twice** — a row-level security policy in
  Postgres _and_ `withOrgScope` around the query. Neither is trusted alone. The
  application connects as a role that cannot bypass row-level security, so a
  handler that forgets the scope reads **nothing** rather than reading everybody.
- **A GET renders on the server; a write happens on the client.** A read a route
  can name is a route loader that hydrates the atom the screen already uses. No
  skeletons, one query, and `apps/mobile` renders the same atom with no server at
  all.

`.agents/skills/effect-sql-rls/SKILL.md` and
`.agents/skills/tanstack-start-ssr/SKILL.md` are those two written out for an
agent, and they are the fastest way for a person to learn them too.

### 5 · Your first feature

```bash
bun run new:module billing-reports
```

That writes the package, registers it where the compiler has to be told, and
leaves you two deliberate steps it prints: adding the group to `AppRpcs` and
registering the module in `Main.ts`. What an application serves is a decision,
not a side effect of creating a directory.

Then the loop:

```bash
bun run dev
bun run preflight     # format, check, lint, hygiene, test
bun run gate          # preflight + the browser suite
```

`gate` is the bar a slice passes before it is called done. `preflight` is the
inner loop and deliberately does not start a Postgres container and two servers,
because the command typed twenty times a day should not cost what the one typed
twice a day does.

If you are driving an agent, the skills in `.agents/skills` are already loaded and
the hooks already refuse what the repository forbids. `docs/workflow/` is the four
phases — discover, prototype, build, ship — and `/product-build` takes the topmost
slice of `SPEC.md` that is not landed, rather than whatever the conversation
suggests.

Start a product with **`/grill-me`**, before `/product-discover` writes anything.
Discovery's failure mode is not missing information, it is two people agreeing on
a sentence that means different things to each — and finding out in the build
phase. `docs/workflow/00-overview.md` lists every command the vendored skills
bring and the phase each belongs to.

### 6 · Shipping

```bash
bun run build:images                  # all six, ~30s each
bun run deploy:plan --stage staging   # the diff, before anything changes
```

`alchemy.run.ts` describes the whole deployment — a Railway Project per stage,
Postgres, Redis, five services, their variables and health checks — and
`.github/workflows/deploy.yml` applies it once CI passes. Two lines change on a
fork.

Read `docs/deploy.md` before the first deploy rather than after: where the state
lives, why secrets now come from the deploying environment, and why
`AUTH_COOKIE_DOMAIN` decides whether anybody can sign in at all.

### Where to go next

| You want                          | Read                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| The whole architecture, in detail | `AGENTS.md` — long, and the most useful file here               |
| The rules, hard                   | `RULES.md`                                                      |
| Auth, SSO, directory sync         | `docs/sso.md`, `docs/scim.md`                                   |
| The AI slice and its evals        | `docs/evals.md`, `docs/mcp.md`                                  |
| The design round trip             | `docs/figma.md`                                                 |
| Mobile                            | `docs/mobile.md` — it bundles, and has not run on a device here |

## Making it yours

**Rename.** The package scope is `@vantion/*` and appears in imports throughout.
One pass does it:

```bash
grep -rl '@vantion/' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=repos . | xargs perl -pi -e 's|\@vantion/|\@acme/|g'
```

Then the loose ends: `name` in each `package.json`, the database name in
`docker-compose.yml` and `.env`, `OTEL_SERVICE_NAME`, `EMAIL_FROM`, and the repo
and `REPO` in `alchemy.run.ts`.

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

|                                   |                                                     |
| --------------------------------- | --------------------------------------------------- |
| `bun run dev`                     | API, front end and worker together                  |
| `bun run design`                  | the design app, on persona fixtures                 |
| `bun run marketing`               | the marketing site, server-rendered                 |
| `bun run brand`                   | the brand kit, generated from the tokens            |
| `bun run mobile`                  | the Expo app, against the same API                  |
| `bun run new:module <name>`       | scaffold a feature package and register it          |
| `bun run agents`                  | regenerate `.cursor/rules` and `.codex` from skills |
| `bun run build`                   | deployable artifacts for every package              |
| `bun run check`                   | `tsc -b` across all project references              |
| `bun run lint`                    | oxlint, including Effect type-aware and local rules |
| `bun run format` / `format:check` | dprint                                              |
| `bun run test`                    | vitest across `apps/*` and `packages/*`             |
| `bun run e2e`                     | Playwright, driving both servers in a browser       |
| `bun run evals`                   | the assistant's test set, against its baseline      |
| `bun run vendor`                  | re-vendor the upstream source under `repos/`        |

Postgres-backed tests skip without a database. Either `docker compose up -d`, or
point at an existing instance with `TEST_DB_URL=postgresql://...`.

`bun run e2e` runs the browser suite in `e2e/`. It needs no setup and no running
app: it starts its own Postgres on a free port, applies the migrations, runs
both servers on ports of their own, and cleans up after itself. Run
`bun run --filter @vantion/e2e install-browsers` once first.

## Deploying

`bun run build` produces the API bundled to `apps/server/build/bundle/main.js`, the
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

`alchemy.run.ts` describes the whole deployment as an Alchemy stack: a Railway
Project per stage, Postgres, Redis, and all five services with their variables and
health checks. A pull request gets the plan; a push to `staging` or `main` applies
it once CI passes, and production waits for a reviewer. Change `REPO` on a fork,
and put the secrets in the two GitHub environments — the deploying environment is
the source of truth for them, not Railway's dashboard.

A stage is a Project, so staging and production share nothing, and Alchemy's own
record of what it deployed lives in a Postgres outside both. Setting `domain` on a
stage creates `app.` and `api.` under it. `docs/deploy.md` has all of it,
including Railway's per-PR environments, which still work as a dashboard toggle
on the staging Project.

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
changing much. `knowledge/README.md` indexes the per-topic guides, and
`knowledge/rules/effect-reach-for.md` is the one to read when a task does not
resemble anything already here — keyed on the problem rather than the module
name, because the failure it prevents is writing four hundred lines of something
Effect already has.

`docs/workflow/` is the method, written out phase by phase, `docs/figma.md` is
the design workflow and its one account caveat, `docs/mcp.md` connects an editor
to the MCP server, `docs/evals.md` is the eval set and what its gate can honestly
enforce, `docs/mobile.md` is the Expo app and the three seams it needs,
`docs/admin.md` is the cross-tenant boundary and what enforces it,
`docs/redis.md` is what Redis is for and what breaks without it, and
`docs/sso.md` is single sign-on — who may turn it on, why the domain has to be
proved, and what has not been tested against a real identity provider.

`repos/` vendors the Effect and effect-form sources at exactly the versions this
repo depends on. Effect v4 is a release candidate whose APIs moved recently, so
read the real signature there instead of trusting recall, including your own.

## Bun, and the one place it is not

`bun install`, `bun run dev`, `bun run test`. The API, the worker and the MCP server boot
under Bun through `@effect/platform-bun`, and every script in `scripts/`, `tooling/`,
`e2e/` and `evals/` is a `.ts` file Bun executes directly. `.bun-version` pins it.

Everything runs in Bun, including the tools. Every `vite`, `expo`, `playwright` and
`vitest` invocation is prefixed `bun --bun`, which forces the Bun runtime rather than
letting a `#!/usr/bin/env node` shebang hand the process to Node. There is no `.nvmrc` and
CI installs no Node.

Two things had to change for that. The test DOM is `happy-dom` rather than jsdom, whose
`EventTarget` is what actually breaks under Bun — not vitest, which was blamed first. And
the tool invocations are explicit about the runtime, since a shebang otherwise wins.

## Status

**Effect v4 is a release candidate.** This repo pins one exact version
(`4.0.0-rc.117`, in `package.json`) and vendors its source under `repos/`
so the APIs you read are the APIs you have. That is a stronger position than
most, but it is still an RC: `effect/unstable/*` means unstable, and a bump is a
deliberate step rather than a background one.

**Some of this is newer than the rest.** Auth, organizations, access control,
tenant isolation and the public API came from production work and have been
exercised. Billing, jobs, webhooks, the design app and the Figma path are newer,
tested but not yet weathered.

**`apps/mobile` compiles and bundles, and has not been run on a device here.**
It type-checks, its theme conversion is tested and `expo export` produces a
bundle — but nobody in this repository has watched it move, and `docs/mobile.md`
says so rather than leaving you to find out.

## Roadmap

What is missing, in the order it is likely to land. All of it is tracked in the
open, and none of it is waiting behind a paid tier.

|           | What                   | Why it is not here yet                                                                                                                   |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Next**  | A design pass          | Every prerequisite is in — tokens, motion, the component library, three surfaces on one canvas. The design itself has not been done.     |
| **Then**  | `apps/docs`            | A docs site built before the design is settled gets redesigned twice.                                                                    |
| **Later** | Webhook secret overlap | Rotating invalidates the old secret at once. Two live secrets is a second column and a second `v1=`; `docs/webhooks.md` says so plainly. |
| **Later** | i18n                   | Listed below as a deliberate absence, and it stays one until somebody needs it.                                                          |

**Shipped since this table was last wrong:** SSO, SCIM provisioning, outbound
webhook management, usage against plan limits, onboarding, and the move to Bun.
A roadmap that still advertises what it ships is the commonest stale thing in a
README, so this one is checked when a slice lands.

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
