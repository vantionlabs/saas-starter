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

## Seeding a local database

`pnpm seed` fills a local database with three organizations that mirror
`apps/design`'s personas — a first day, an ordinary tenant, and the crowded one
whose long names and many rows are what actually break a layout. An empty
application proves nothing: every list is its empty state, no screen is seen
under load, and the admin panel has no tenant to open.

Two things about it are not incidental. **Users are created through the API**,
never by writing to `user`: better-auth owns that table and hashes with scrypt,
so a row inserted by hand would have a password nobody could sign in with —
which is the one thing the script exists to provide. And it **renames and fills
the organization sign-up already made** rather than creating tenants beside it,
because better-auth gives every account a personal organization and picks the
active one at sign-in; a tenant on the side would leave whoever signed in
staring at their own empty org, hunting for the switcher.

Tenant rows go through `withOrgScopeFor`, since the application role is
`NOBYPASSRLS` and an unscoped insert into `contact` is refused outright. The
subscription goes through `withWorkerScope`, because that table's `with check`
is worker-only — Stripe's webhook is the only thing that may change a plan.
Seeding through the product's own write path is also what stops a fixture
describing a state the application could not have produced.

It is re-runnable: fixed ids with `on conflict do nothing`, and an address that
already exists is not a failure.

```
pnpm services          # postgres, redis, jaeger
pnpm db:migrate
pnpm dev               # the API must be up; users are created through it
pnpm seed
```

Everybody's password is `seedpassword`, and `staff@vantion.co` is the account
made staff so `apps/admin` opens without a SQL statement — the one
`0014_staff.sql` tells you to run, run for you.

## A GET is rendered on the server; a write happens on the client

A dashboard that fetches after hydration shows a spinner for work the server
could already have done, and asks the reader to wait twice — once for the page,
once for its contents. So a read that a route can name is a **route loader**,
and what stays in the browser is what a person asks for: creating, editing,
deleting, and the refetch that follows one.

It is one query either way. `contactsAtom` is still what the screen reads, still
what a write invalidates, and still what `apps/mobile` renders with no server
behind it at all — the loader only arranges for it to arrive already full.

Three pieces, and the middle one is where the mistake is easy to make.
`apps/web/src/server/rpc.ts` is the RPC client as the server uses it: the
browser's client sends `credentials: "include"` and lets the platform attach the
session, and there is no platform here, so the cookie is forwarded — **read from
the request inside `serverRpc`, not passed in**. It was a parameter at every
call site once, which made the one thing that must never be forgotten into one
somebody could pass the wrong value for. Only the cookie goes: handing a whole
header set to an internal service sends `host`, `content-length` and whatever a
proxy added, none of which describes the caller.

`apps/web/src/server/reads/` is a server function per read, one file per concern
the way `packages/core/src/atoms/` is split. `apps/admin/src/server/` divides
the same way — `auth.ts` answers who is asking, `queries/` holds the procedures
— because one file holding the authentication _and_ every read is the one that
grows a procedure somebody forgot to put `requireStaff` in front of.

`/settings/security` and `/settings/sso` are server-rendered too, and they go
through **better-auth's client** rather than `serverRpc` — there is no RPC in
front of those endpoints, deliberately, because `/sso/providers` already filters
to what the caller administers and already strips the client secret. `asCaller()`
forwards the request's cookie to it, the same move `server/session.ts` has made
for the session since SSR landed.

The SSO atom carries five fields rather than better-auth's whole inferred
provider. Hydration needs a schema, and a schema for the full shape would be the
copy this repository warns about: it has a nested `oidcConfig` nothing on that
page reads and would drift the moment better-auth changed it. Four of the five
are `SsoProviderRow` in `@vantion/ui` — the panel's own contract — and
`organizationId` is the fifth because the screen filters on it.

A route may hydrate more than one read, and that screen is why: it lists
providers _and_ needs the plan, since single sign-on is gated on an entitlement.
A loader returns one dehydrated read or a list of them.

Server functions are for **GETs**, and `tooling/test/server-functions.test.ts`
keeps it that way — the rule is invisible at the call site, because
`createServerFn({ method: "POST" })` reads perfectly well and says nothing about
which half of the application it belongs to. A write is a form on the client,
and the RPC behind it is already authenticated by `AuthMiddleware`: a loader
that forgot its guard renders an error rather than somebody else's data. And
hydration puts the result into the atom.

The admin panel's reads are `GET` too, payload and all. Worth knowing rather
than hiding: a `GET` payload travels in the URL, so a reason and an email
address appear in whatever access log sits in front of that app. Acceptable for
an internal surface already expected to sit behind a VPN or an allowlist, and a
reason not to put it on a shared ingress with third-party logging.

**One boundary, at the root, above the shell.** `HydrationBoundary` applies a
value immediately only for an atom that has _no node yet_; for one that already
exists it defers to an effect — and an effect never runs during SSR. The app
shell reads atoms of its own (the command palette reads contacts, the switcher
reads organizations) and renders before the child route does, so a boundary
inside a route arrived too late for exactly those atoms and left them `Initial`
on the server. The page rendered its empty state, the browser fetched the same
data again, and the only symptom was a hydration mismatch in the console.
`useHydratedMatches` collects every matched route's dehydrated data so it lands
before anything has read an atom.

This is also the failure a test can pass straight through. The router serialises
every loader's result into the document, so a contact's address is in the HTML
whether or not anything rendered it — the first version of
`contacts.spec.ts`'s SSR test asserted on raw text and was green while the
server was emitting the empty state. It strips `<script>` blocks first now, and
fails if hydration is disabled.

**Hydration, not seeding.** `useAtomInitialValues` looks like the tool and is
not: it marks the node **valid** — computed, fresh, done — so the atom never
builds a lifecycle, and a mutation that invalidates its reactivity key has
nothing to refresh. The table showed the server's rows and then ignored every
write, intermittently, because which of the seed and the first fetch won was a
race. `Hydration` instead _preloads_ the encoded value through
`registry.setSerializable`, and the node collects it when it builds: the atom
has the server's data and is still live.

So each server-rendered read is `Atom.serializable({ key, schema })` in
`packages/core`, beside the atom rather than in the app — the server needs the
same key and schema to encode, and a pair kept in two places is a pair that
drifts into hydrating nothing while the page quietly fetches again. The schema
covers the whole `AsyncResult`, because that is what the atom's value is.

`RegistryProvider` in `__root.tsx` is what makes any of this safe. It builds a
registry per React tree, so each request gets its own; the module-level default
registry would be shared by every request the process handles, and a preload
would serve the first caller's data to everybody after.

**A write is a form, and a form is effect-form.** `FormReact.make` over a
`FormBuilder`, living in the app rather than in `@vantion/ui` — the library
binds the submit into the form definition, so a shared component taking
`onCreate` as a prop cannot be one. `apps/design` renders plain inputs for the
layout, as it does for sign-in, because validation and submit state are the part
of a form that has nothing to do with how it looks.

That also _removes_ a problem rather than managing it: effect-form does not
render its fields during SSR, so there is no window in which somebody can type
into a control that is not listening.

**A field's rules are declared once, in the contract.** `ContactFields` in
`ContactRpc.ts` is what the `CreateContact` payload is built from _and_ what the
form validates with, so the form refuses exactly what the server would. They
were two declarations of one rule before — the procedure checked `isNonEmpty`
with no message while the screen kept its own copy with a readable one, and the
server's was the version nobody could read. Every check carries a `message`,
because that is what a person sees; `apps/mobile` gets the same sentences
without inventing any.

**A failed submit is two different things.** `submitMessage` in
`apps/web/src/lib/form/result.ts` tells them apart: a `SchemaError` is the form
failing to decode, anything else came back from a server. Saying "check the
fields above" to somebody whose permission was denied sends them looking in the
wrong place — and writing that test the other way round, as "not this one
particular error", is how every error added later inherits the wrong message.

`useHydrated` is for what is **not** a form: **a control whose only job is to
run a handler is disabled until React is listening.** The upload button on
`/files`, the assistant's Send, the "Set up" on `/settings/security` — all three
look live in the server's markup and all three did nothing when pressed,
silently, which is the worst version of a bug. Disabling them until hydration is
honest, and it is the only signal the markup gives a browser test that the page
is real, which is what keeps the e2e suite deterministic rather than a
collection of retries.

Note the trap it sprang twice. The upload button was _already_ disabled until
the caller's permissions arrived, so it encoded hydration by accident;
server-rendering the identity made it enabled from the first byte and the tests
went red. And the third case was found only by CI, on a machine slower than the
one it passed on. A signal that works by coincidence stops working the day the
coincidence does.

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
3. `knowledge/rules/` and `knowledge/skills/` — including
   `knowledge/rules/effect-reach-for.md`, which is keyed on the problem rather
   than the module name and is the one to read when a task does not resemble
   anything already in this repository
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
to work from. `scripts/vendor.ts` removes the directory and adds the subtree afresh,
which works in any history and does not conflict the way a pull across 3,500 files does.

## Tooling is TypeScript, and its CLIs are Effect's

`scripts/vendor.ts` is the worked example: `effect/unstable/cli` rather than a `.mjs` reading
`process.argv`. This was the one corner of an otherwise fully typed repository where an
argument was a string nobody had checked, and the CLI is not ceremony — `--help` and shell
completions are generated rather than written, the argument is validated against the sources
that actually exist, and the handler is an ordinary `Effect`, so what used to be
`process.exit(1)` in four places is now two typed errors.

It runs under `tsx`, the same way `packages/database`'s migration runner does.
`NodeServices.layer` provides the whole of the CLI's `Environment` — filesystem, path, stdio,
terminal, child process — in one layer.

Everything that can be TypeScript now is: `sync:skills`, `new:module`, the tokens scripts, the
whole e2e harness, the eval runner and the brand prerender. Each takes its flags through
`Flag`/`Argument` and reports failures as typed errors rather than `process.exit(1)`, and
`tsconfig.tools.json` covers them so `pnpm check` type-checks them like everything else.

Two sets stay `.mjs`, and neither is an oversight:

- **`.claude/hooks/*.mjs`** run on every `Edit` and `Write`. They must start in milliseconds,
  and `tsx` adds a compile step to each invocation; `check-rules` also has to work when
  `node_modules` is broken, which is exactly when somebody is editing under pressure.
- **`scripts/oxlint-rules/*.mjs`** are loaded by oxlint itself, which reads JavaScript. There
  is no TypeScript to convert them to that oxlint could run.

## Hygiene, and what each tool is actually for

`pnpm hygiene` is knip, syncpack and secretlint, and CI runs the same command rather than three
steps of its own — a failure there is reproducible by typing one thing.

- **knip** walks the import graph for unused files, exports and dependencies. Its first run
  removed 26 dependencies and 15 devDependencies that nothing imported, and seven catalog
  entries left behind with them. What it cannot see is in `knip.jsonc` with a reason beside it:
  binaries are run rather than imported, some workspace dependencies exist for `tsc -b`
  ordering, and `@lucas-barake/effect-form` must stay in the catalog because
  `vendor-sources.test.ts` asserts it is there.
- **syncpack** compares every manifest against the catalog. The single deliberate divergence —
  `apps/mobile` pinning Tailwind 3 for NativeWind v4 — is declared in `.syncpackrc.json`, which
  is what stops it reading as drift.
- **secretlint** scans for credentials. Verified by planting one: AWS's _documented example_
  keys are allowlisted by the preset, so a probe using them proves nothing, and a realistic
  key is caught.

`lefthook` runs formatting and secretlint on staged files at commit time. The Claude hooks in
`.claude/hooks/` only fire when an agent edits a file — that is the case where somebody is
already watching; this is the other one. A secret in a commit is in the history whether or not
the next commit removes it, and this repository is a public template.

It installs itself from the root `prepare` script, which is guarded on a git checkout existing
— and that guard is load-bearing rather than defensive. `prepare` also runs inside every
`pnpm install --frozen-lockfile`, which is the first line of all six Dockerfiles, and the build
image carries no `git`; an unguarded `lefthook install` therefore failed every image build at
once while `pnpm check`, `pnpm lint` and the whole test suite stayed green. Nothing in CI built
an image, so the next thing to notice would have been a deploy. `.github/workflows/nightly.yml`
is the answer to that, and this is the break it was written for.

`.ignore` keeps `repos/` out of ripgrep, and therefore out of every agent search. Reading it
deliberately is the point and `rg --no-ignore` still does; having 3,558 vendored files in the
results of every unrelated query is attention spent for nothing.

`pnpm preflight` is format, check, lint, hygiene and test in the order they should run, and
`pnpm gate` is that plus e2e. Two names because they answer different questions: `preflight` is
the inner loop, run constantly, and putting a Postgres container and two servers behind it
would make the command typed twenty times a day cost what the one typed twice a day should.
`gate` is what a slice has to pass before it is called done.

Neither builds an image, which is deliberate and is why `build:images` is separate: six cold
builds is half an hour. What a build would have caught is covered instead by
`tooling/test/docker.test.ts` in the fast gate, by a single server image in CI, and by the
nightly matrix for the rest.

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
| `pnpm services`                              | Postgres, Redis and Jaeger, via `docker compose`                   |
| `pnpm db:migrate`                            | applies the migrations to `DATABASE_URL`                           |
| `pnpm build:images`                          | all six deployable images                                          |
| `pnpm fix`                                   | `format` then `lint:fix` — what to run before reading a diff       |
| `pnpm e2e:install`                           | the one Playwright browser the suite needs, once                   |
| `pnpm preflight`                             | format, check, lint, hygiene and test, in that order               |
| `pnpm gate`                                  | `preflight` and then e2e — what a slice has to pass                |

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

`pnpm dev` runs the three that make the product; `pnpm dev:all` runs every app, which is
rarely what you want and occasionally exactly what you want. `pnpm services:reset` is the one
to know the shape of: it takes the volumes with it, so it discards the database.

Each app owns a `Dockerfile`, built from the repository root because pnpm resolves a workspace
package against the root lockfile and every sibling manifest:

```
docker build -f apps/server/Dockerfile -t vantion-api .
docker build -f apps/web/Dockerfile    -t vantion-web .
```

Every image builds with `--workspace-concurrency=1`, and so does `pnpm build`. `tsc -b` in one
package builds the _projects_ of the packages it references, and several here reference the
same ones — `modules/agent` and `modules/assistant` both reference `packages/database`. Run in
parallel, two `tsc` processes write that project's output and `.tsbuildinfo` at once and a
third reads it half-written, which surfaces as `error TS2306: File 'src/PgTest.ts' is not a
module` on a file that is one. No package-level ordering fixes it: pnpm orders by
`package.json` and the duplicated work is inside tsc's own reference graph. The race was always
here; building the whole closure made it likely rather than rare, and it appeared in CI while
passing three times locally.

Each one's `deps` stage copies only the manifests that image's build reaches, so a source
change does not reinstall the world and no image pulls React Native, Expo or Playwright. That
subset is a registration elsewhere, though, and it had drifted in **all six at once** —
`packages/modules/health` was listed in none of them. `tsc -b` follows project references and
`@vantion/domain` aggregates every module, so building it reached packages whose dependencies
had never been installed and the failure read as `Cannot find module '@aws-sdk/client-s3'`:
a missing `COPY` line reported as a missing npm package.

`tooling/test/docker.test.ts` computes the workspace closure of whatever each Dockerfile says
it builds and asserts the copied set is exactly that — both directions, because a manifest an
image does not need is a layer invalidated by a change that cannot affect it. It runs in
`pnpm test`, and its failure prints the `COPY` lines to paste.

An image also has to **build what it depends on**, which is what `pnpm --filter "@vantion/web..."`
means — the `...` is pnpm for "and its dependencies". A workspace package resolves to
`build/src/*.js` under its `default` export condition, and `.dockerignore` keeps build output
out of the context, so a value imported from a module does not resolve until something has
built it. Type-only imports are erased and never notice, which is why this surfaced on exactly
one line: `MAX_UPLOAD_BYTES` in `routes/_protected/files.tsx`. The API and worker images never
hit it because they already build `@vantion/domain` first, which builds every module on the way.

The same applies outside Docker. The nightly mobile job bundles with Metro, which resolves
`@vantion/tokens` through `default` as well, and a bare filter fails on
`Cannot find module '@vantion/tokens/build/src/color.js'`. A local run cannot catch either one,
because a working tree has the build output a fresh checkout does not.

Nothing in `pnpm check`, `pnpm lint` or the test suite builds an image, which is the gap
`.github/workflows/nightly.yml` covers: the mobile bundle and all six images, nightly, because
together they take longer than the rest of CI and a break in them does not block a merge.

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

Deliveries run **concurrently, bounded twice**. Both loops used to be sequential — one
endpoint at a time, one job at a time — which is bounded and slow in the worst way: a receiver
that accepts the connection and then sits there held up every other endpoint and every job
behind it for the length of the timeout, so one customer's wedged server was everybody's delay.
`Effect.forEach` with a `concurrency` caps each loop, and `Outbound` — a `Semaphore` from
`WEBHOOK_CONCURRENCY`, default 20 — caps what the process holds open, because ten jobs each
fanning out to five endpoints is fifty sockets and neither loop can see the other. A test
asserts the pool never runs more at once than it has permits, and another that it is not
quietly serialising everything.

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

Rate limiting counts in **Redis when `REDIS_URL` is set**, memory when it is not, and the
difference is a security property rather than a performance one. An in-memory store counts per
process, so N replicas behind a load balancer give a caller N times the limit — and
`AuthHttp.ts` says throttling _is_ the boundary on the OTP path, where twenty bits of entropy
are only as strong as the number of attempts allowed. This shipped as `layerStoreMemory` with
a comment offering Redis as a way to "share limits across workers", which undersold it: it is
the `X-Forwarded-For` failure again, on the same endpoint, from a different direction. One
instance without Redis is fine; more than one is not, and `docs/redis.md` says so.

The **entitlement resolver is cached** on that same store — thirty seconds in Redis, two in
each process's own cache in front of it. Caching authorisation is a security decision rather
than a performance one, so the numbers live in `identity/Cached.ts` with the reasoning beside
them. Invalidation is explicit and that is why the store is shared: the Stripe webhook drops
the entry, so a **downgrade** stops entitling on the next request on every replica rather than
lingering for a TTL — the expensive direction of being wrong. What the TTL still bounds is the
in-process layer, which invalidation on one replica cannot reach; two seconds is that worst
case. A cache that cannot be reached falls through to the database rather than refusing.

`PermissionResolver` is cacheable and **off by default**. `PERMISSION_CACHE_TTL` is `0`, and
zero means the resolver is passed through rather than wrapped in a zero-lifetime cache — which
would still pay a round trip per request to learn the entry had expired. The asymmetry with
entitlements is the point: a plan change hides inside a delay the product already has, and a
revoked permission does not. Turned on, all four access write handlers drop the affected
members' entries from the shared store, so an override or a role edit lands on the next request
on every replica; what stays bounded by the TTL is anything done through better-auth's own
dynamic access-control endpoints, which this module does not wrap. The role is part of the key,
not only the lookup, so reassigning somebody cannot hand them what their old role cached.

`packages/redis` builds the `Redis` service over **ioredis**, not the `NodeRedis` layer
`@effect/platform-node` ships. BullMQ requires ioredis and is not negotiable, so the platform
layer would mean two client libraries and two pools in one process; `Redis.make` wants one
`send` function and builds script caching on top, so the adapter is twenty lines. It lives
beside `packages/database` because `RULES.md` says a vendor wanted by more than one module
becomes its own thing — jobs want it, rate limiting wants it, caching will.

The **public API is rate limited too**, and was not at all before: a key could be called
without bound, which on a versioned surface with no session and no captcha is the easiest
thing here to abuse. The allowance is a plan limit, so an upgrade raises it on the next
request, and it is keyed on the organization rather than the key — a key is a credential and
a quota belongs to whoever pays for it, so a second key does not double what a tenant may do.
`429` is declared in `api/v1/Wire.ts` beside the other statuses so it reaches the OpenAPI
document; a generated client that does not know to back off will not.

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

Metrics are the third question, and until recently nothing answered it. A span says what one
request did; `ErrorTracker` says the same failure has happened four hundred times since
Tuesday; neither says how deep the outbox is _right now_, or what share of deliveries are
failing. Those are aggregates over time, which is what a metric is and what the other two
cannot be turned into.

`packages/telemetry/src/Metrics.ts` declares them in one place rather than beside the code
that updates them, because a name is a contract with whatever is graphing it and one renamed
in a module but not on the dashboard is a chart that silently goes flat — the failure where
the code looks fine and the operator is last to know. A test asserts the names for that
reason. They export through the same `OTEL_EXPORTER_OTLP_ENDPOINT` as the traces, on the same
switch: a deployment that had to configure two destinations to get both would configure one.

Six of them, each at the site that owns it — outbox depth and events relayed in `Relay.run`,
deliveries by outcome and endpoints switched off in the webhooks module, cross-tenant reads in
`crossTenant`, and refusals in the auth rate limiter. The last is the one worth naming: on the
OTP path the limit _is_ the security boundary, so a limiter that has stopped engaging looks
exactly like one nothing is testing.

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

When an action concerns exactly one organization, **that tenant's own `auditEntry` gets a row**
— actor `staff`, the action, the reason — in the same transaction as the staff record and the
read. `adminAudit` answers what staff have been doing; this answers what a customer asks, from
the screen they already use. A read across every tenant names nobody, and a read of an
organization that is gone writes nothing: the insert is a `select … where exists`, because
`auditEntry.organizationId` has a foreign key and staff follow stale links.

`adminAudit` carries a policy that is never true — `using (false) with check (false)` — so the
application role, which owns the table because it runs the migrations, can neither read nor
write a row of it. A staff trail the application can write to is one a compromised application
can rewrite.

**And it is read from inside the panel**, at `/audit`, which is the one screen here that does
not ask for a reason and the one privileged read that does not go through `crossTenant`.
`StaffTrail.ts` carries the argument and it has two halves. Routing it through `crossTenant`
would append a row saying the log had been read, and the next review would read that one too —
unbounded growth in the one table that has to stay legible. And charging a ticket number for
checking what your colleagues have been doing is how the checking stops; a reason is the right
price for opening a customer's records and the wrong price for oversight.

What it keeps is the part that matters: `CurrentStaff` is still required, and the connection is
still the one holding BYPASSRLS, because the application role cannot read a row of that table
whoever is asking. It takes no query — unlike `crossTenant` it is not generic over a read, and
that is the whole of why a second door onto the privileged connection is safe: there is nothing
to pass it. A generic version would be an unaudited way to reach every table.

The trail was written for a year before anything read it, which is the failure this closes: a
log nobody can open is not a control, it is a record of one.

`Staff` is its own type, not an `Identity` with a flag. `Identity` carries an `orgId` because
every other caller acts inside exactly one organization; a flag would let a caller for whom
that field is meaningless reach every handler that takes one, with nothing for the compiler to
say about it.

`GetOrganization` also answers the two questions a support ticket usually turns
out to be. **What Stripe says**, separately from what the product enforces —
they disagree on purpose, since a `canceled` subscription falls back to free
while the row still records what was bought, and "I have been charged and I am
on the free plan" is a different bug from "I have not been charged". A tenant
that never subscribed shows as such rather than as free, because never having
paid and having stopped are different tickets. And **whether their background
work is moving**: an outbox that only grows explains a webhook that never came,
a switched-off endpoint explains one that stopped last week. Counts, like
everything else here.

`/settings/security` is where anybody enrols, and `/auth/two-factor` is the step a sign-in
stops at once they have. That second page is not optional: with 2FA on, better-auth answers a
correct password with `twoFactorRedirect` rather than a session, so without somewhere to send
the browser the sign-in looks like a silent success followed by no session — indistinguishable
from a broken cookie.

Enabling or disabling asks for the password again, because doing either from a session somebody
else has stolen would be a way to lock the owner out rather than a way to protect them. And
enrolment is not finished until a code from the app verifies: `enable` already switched it on,
so somebody who closed the dialog without scanning would be locked out at their next sign-in.
The backup codes are shown exactly once and said to be — better-auth stores them hashed, so
"show them again" is not a feature anybody can build.

Staff **may** also be required to hold a second factor, behind `ADMIN_REQUIRE_2FA`, which is
off. The role is the authorisation gate and always was: 2FA decides how strongly somebody
proved they are the person who may, which is a different question and a deployment's to answer.
Off by default because the first staff member would otherwise have to enrol before the panel
opened at all — and worth setting for real customer data, because this surface holds
`ADMIN_DATABASE_URL` and a role check cannot tell a stolen session from a real one. With it on
the check runs per request, so turning 2FA off closes the panel immediately. TOTP rather than
OTP over email — a second factor sent to the address that recovers the first is a second lock
with the same key.

`TwoFactorRequired` is the one refusal on that surface that names itself, and the reason is
that the caller has already proved who they are: there is nothing left to leak, and it is the
only refusal they can act on. Note the shape of the bug that nearly hid it — `Effect.catchCause`
at the end of the resolver caught typed failures as well as defects and reported it as
`NotStaff`. `catchDefect` is what that line wanted.

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

`apps/admin` is that application: a TanStack Start app, its own deployable, and the only image
given `ADMIN_DATABASE_URL`. The separation is the control rather than tidiness — a distinct
origin can sit behind a VPN or an IP allowlist and a route inside `apps/web` cannot, nor can a
cross-site scripting hole in the customer product reach across one.

It calls its procedures **in process**. `apps/web` uses RPC because its server is a different
process; this app's server _is_ the process holding the admin connection, so a wire format
between them would be a contract with itself. `Organizations.ts` holds the procedures as plain
effects, and `AdminRpcs` is the other transport over the same implementation — for a client
that is not the page this process rendered.

The reason comes before the data: each screen asks why and fetches nothing until it has an
answer, because a reason box that can be skipped is one that is always empty. Staff sign in
through the ordinary sign-in page, which is the honest limitation — this surface is only as
strong as an individual's account, and `docs/admin.md` says so rather than implying otherwise.

**`apps/server` does not register the admin module and must not.** The process serving customer traffic does not
hold the credential.

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
