# SaaS starter

Effect v4 monorepo. bun workspace + `tsc -b` project references, oxlint + dprint, vitest.

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
travels in the query string, so a designer can link to exactly the state they mean. `bun run
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

## Long lists

`DataTable` in `packages/ui/src/ui/data-table.tsx` is TanStack Table over this
repository's own `Table` primitives — headless, so the markup is unchanged and
what it brings is sorting, filtering and paging. Contacts and the audit log use
it, because those are the two that grow: one without limit, the other a hundred
rows at a time, and both are read when somebody is looking for a _particular_
thing.

**Paged, not virtualised**, and that is the decision to know. Virtualising
renders only the rows in the viewport, so the server renders a handful and the
rest appear when JavaScript runs — exactly what every read on these screens was
moved to a loader to avoid. A page of rows is completely server-rendered and
readable without JavaScript. A list long enough that paging hurts wants a
server-side query, not a taller window.

Finding nothing is not the same as having nothing. The empty state is for an
empty list; a filter that matches no rows says so and **keeps the box**, or
somebody is left with no way to undo the search that emptied their screen.

Columns are memoised at every call site, because the column array is an input:
a fresh array each render is a fresh table each render, which throws away the
sort order and the filter somebody is halfway through typing.

**v8, not v9.** v9 is days old and its option shapes are documented only in its
type definitions — I reverse-engineered `_features`, `_rowModels` and the column
generic order from `.d.ts` files before concluding that a template's job is to
be legible to whoever clones it, and everything they will find is v8. Worth
revisiting when v9 has documentation; it is a version bump rather than a
rewrite, since the markup is ours either way.

## Motion

Durations and easings are **tokens**, in `packages/tokens`, for the same reason
colour is: three consumers need them and only one speaks CSS — the stylesheet,
`motion/react` in `packages/ui`, and `apps/brand`. That last one is why this
moved: the brand kit kept its own copy of the three curves inline, the one part
of a page whose whole argument is that every value on it is generated. A brand
document naming a different easing than the product animates with is worse than
none, because people believe it.

Three durations and three easings, deliberately. A scale with seven steps is one
where nobody can say which to use, so every choice becomes a guess and the
product ends up with nine.

**Nothing that is server-rendered may start invisible.** An entrance animation
is `initial={{ opacity: 0 }}`, and on a server-rendered page that ships the
markup with its content hidden until JavaScript runs — undoing the reason the
read was moved to the server, and leaving anything without JavaScript looking at
an empty page. `Reveal` renders its children plainly until `useHydrated` says
React has attached, and a test asserts the server markup contains neither
`opacity:0` nor the hidden content. Removing that guard makes the test print
`<div style="opacity:0">Nine hundred contacts</div>`, which is the whole point.

So motion is for **chrome**: something that appeared because a person did
something, after hydration. A validation message, a panel opening, a row just
created. Not a table that came down with the page.

Everything respects `prefers-reduced-motion`, via `useTransition` collapsing to
zero duration rather than removing the animation — the end state stays
identical and only the travel goes.

`LazyMotion` with the `m` component and `strict`, not `motion.div`. Measured:
the full component adds **124 kB** of client JavaScript, the same order as the
Stripe SDK that once leaked into this bundle; `m` plus `domAnimation` brings it
to about 80 kB. `strict` makes `motion.div` throw at runtime, so the expensive
import cannot return by habit.

## The account is not the organization's

`/settings/*` belongs to a workspace and is gated on what somebody may do inside
it. `/account/*` belongs to the person and follows them between organizations —
their name, their password, their sessions, their second factor. Two areas
rather than two sections of one, because mixing them is how "delete account"
ends up beside "delete organization", and how a member with no admin rights goes
looking for their own password behind a permission check.

Two-factor moved there for exactly that reason: single sign-on decides how an
_organization_ admits people and stays in settings; a second factor is one
person's own credential.

The session list drops the **token at the server boundary**, not in the
component. better-auth returns it on every row and it is the credential itself —
narrowing in `server/reads/account.ts` is what keeps it out of the dehydrated
state written into the page, where a leak would be invisible. A test asserts the
table renders nothing that could be used as one.

Changing a password revokes every other session, because the usual reason to
change one is that somebody else may know it. Changing the **email address** is
deliberately absent rather than half-built: better-auth has to mail the new
address before it takes effect, or an account is stolen by typing, so it is a
verification flow rather than a field.

`accountItems` feeds both the account nav and the command palette, the same way
`settingsGroups` does — a page that exists in a sidebar and not in ⌘K is a page
half the application cannot reach.

## Usage, against the limits that are enforced

A limit nobody can see is a limit people find out about by being refused. `/settings/billing`
carries the counts under the plan, because that is the next question: somebody
arrives here having just been told they cannot invite a fourth colleague.

**Counts live with the tables, not with the plan.** `seatsUsed` and `apiKeysUsed`
are in iam, `bytesUsed` is in files, and `@vantion/module-billing`'s `Usage.ts`
composes them — metering is a billing question, but what a seat is belongs to
identity. A count written beside the limit is the one that quietly stops matching
what the enforcement counts, and a screen saying two of three seats while
invitations are being refused sends somebody to support instead of to the upgrade
button. `seatsUsed` counts _accepted_ members for exactly that reason: it is what
better-auth's `membershipLimit` counts, and a pending invitation is not a seat.

`allowed` travels on each row rather than the client looking it up from a plan
table, so the number shown is the number that refuses. Each row also carries its
**unit**: seats are a count and storage is bytes, and a table that mixed them
would render a hundred megabytes as a hundred files.

Writing it found the other half of the problem: **the `apiKeys` limit was declared
and never checked**. A plan that says two keys and hands out a third teaches people
the number is decoration, and it makes the usage screen a lie rather than a reason
to upgrade. `CreateApiKey` counts first now, and its policy moved to wrap the
_whole_ handler rather than the insert — asked the other way round, somebody with
no right to create a key would be told how many the organization had left, which is
a fact about the tenant handed to a caller who may not act on it.

`LimitReached` carries the number because that is the only part of a quota somebody
can act on, and `/settings/api-keys` says "this plan includes two API keys" rather
than "could not create that key" — the same rule `submitMessage` follows for forms.

`webhookEndpoints` was deliberately absent while nothing in the product could
register one — a row that could only ever read zero is not a measurement. It
arrived with `/settings/webhooks`, which is the rule this panel follows: a meter
appears when the thing it counts can move.

The design app's personas **derive** their usage from their own members and keys
rather than stating it, so a fixture cannot show two seats beside a members table
with nine rows — which is the lie a design app exists to stop somebody shipping.

## Setting up a workspace

Onboarding is **on the organization, not on the person**, and that is the decision
the rest follows from. In a B2B product the thing being set up is the workspace;
kept per user, the second colleague to join would be onboarded into an
organization somebody else had already finished — asked to name a company that
already has a name.

Three states matter and a boolean carries two, so `organization` gained two
nullable columns rather than a flag: `onboardingStep` says which step is next and
`onboardingCompletedAt` says it is over, and answers "when" for free. They can
legitimately disagree — an organization created before the feature existed is
complete with no step, and somebody who skips is complete on step two.

**The step is a write, not client state.** That is the whole of what makes it a
wizard: closing the tab on step two and coming back tomorrow returns to step two.
`SetOnboardingStep` names the step _reached_ rather than incrementing, so two
tabs cannot disagree and finishing the same step twice leaves the same row.
Finishing uses `coalesce`, because the column answers when a workspace was set up
and a second visit to the last screen must not rewrite that.

**The gate is `_protected`'s loader**, beside the identity read rather than in
`beforeLoad`. The two reads are independent, so asked together with `Promise.all`
they cost one round trip's latency; in `beforeLoad` the second would queue behind
the session lookup the first already waited for. A `redirect` thrown from a loader
is resolved on the server during SSR exactly as one thrown above it is, so there
is still no flash of the application before it lands.

`/onboarding` is **outside** `_protected`, or it would redirect to itself — and
it would render the application chrome around a page whose argument is that the
application is not ready. The cost is that everything the shell offers has to be
offered again, which is exactly one thing: signing out. Without it, somebody who
signed in as the wrong person has no way out but clearing a cookie. **Every step
is skippable**, from the first, because a wizard somebody cannot leave is one they
abandon at the browser tab instead; everything it asks for is in settings
afterwards.

An organization created through `CreateOrganization` is **born complete**. Its
creator has just typed the name the first step asks for and is already inside the
product, so sending them through would ask them to name what they just named.
What onboarding is for is the organization sign-up makes on somebody's behalf,
which nobody chose anything about. The seed marks its tenants complete for the
same reason, and `0017_onboarding.sql` backfills every existing organization —
without that, a migration meaning to add a feature takes the product away from
everybody already using it.

The second step is where **inviting somebody** landed, and it exposed a real gap:
this repository had the whole receiving half — the email, the accept page, the
seat limit — with no way to begin one. `InviteForm` is the same component on
`/settings/members`, where it lives permanently, and it goes through better-auth
rather than an RPC of ours because `membershipLimit` is enforced inside its
invitation endpoint. Running out of seats is the one refusal named, because it is
the only one somebody can act on.

The whole of it is `ssr: "data-only"`, the choice `/auth` makes and for the same
reason: the data phase decides both redirects on the server, and the forms cannot
be server-rendered anyway, since effect-form sets its ready flag in a `useEffect`.

Its chrome is `@vantion/ui/onboarding/onboarding-card`, so `apps/design` renders
it, and it uses a real `h1` rather than `CardTitle` — that primitive renders a
`div`, and on this page the title is the whole of what somebody is looking at.

**Every browser test pays for this**, which is worth knowing before writing one:
a fresh sign-up now lands on the wizard, so `e2e/fixtures.ts`'s `signedIn` calls
`completeOnboarding` first. It does its own `goto` rather than inspecting wherever
the caller happened to be — the gate is a loader, so a full navigation lands on
its final URL while a client-side hop passes through `/` on the way, and reading
the URL at that moment returns having done nothing.

## Seeding a local database

`bun run seed` fills a local database with three organizations that mirror
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
bun run services          # postgres, redis, jaeger
bun run db:migrate
bun run dev               # the API must be up; users are created through it
bun run seed
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
browser's client posts to its own origin and lets the platform attach the
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

`/account/security` and `/settings/sso` are server-rendered too, and they go
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
`/files`, the assistant's Send, the "Set up" on `/account/security` — all three
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
inside `bun run test` rather than beside it. What it can enforce on every push is the half that
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

`bun run new:module <name>` writes a module and registers it. A module is five config files
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
this repo depends on (`effect` in `package.json`, currently `4.0.0-rc.117`).

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

`RULES.md` and `knowledge/skills/` have been corrected against rc.117. Each was confirmed by
reading the vendored source or by a compiler error, not inferred:

| Was                       | Now                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ServiceMap.*`            | `Context.*` — there is no `ServiceMap` module                                                                                 |
| `Schema.TaggedErrorClass` | `Schema.TaggedError`                                                                                                          |
| `.asEffect()`             | removed in v4; yieldables that are Effects pipe directly, and `Option`/`Result` use `Effect.fromOption` / `Effect.fromResult` |
| `Effect.fromYieldable`    | does not exist                                                                                                                |
| schema `makeUnsafe()`     | `.make()`, which validates                                                                                                    |
| `@effect/platform`        | gone in v4 — `effect/unstable/http`, `.../socket`, or `@effect/platform-node` / `-browser`                                    |
| `Config.string(…)` etc.   | `Config.String(…)` — every built-in `Config` constructor is PascalCase, and `Config.mapOrFail` is `Config.mapEffect`          |
| `Flag.boolean(…)` etc.    | `Flag.Boolean(…)`, `Argument.String(…)` — and a boolean flag no longer defaults to `false`; omitted, it is a missing flag     |
| `Chat.Service`            | `Chat.Chat`                                                                                                                   |
| `PgClient.fromPool`       | gone — `@effect/sql-pg` is its own driver; see below                                                                          |

`Latch.makeUnsafe`, `Ref.makeUnsafe`, and `Deferred.makeUnsafe` are **real** and were left alone —
`makeUnsafe` is only wrong on schemas.

`knowledge/skills/` diverges from the upstream dotfiles repo on purpose. `bun run sync:skills`
re-applies every correction above after fetching, and fails without writing if any known drift
survives — so a sync cannot silently reintroduce v4-invalid APIs.

Assume more drift exists than is listed here. Check the source.

**`@effect/sql-pg` stopped wrapping `pg` at rc.113**, and that is the one change in the move to
rc.117 that is not a spelling. It speaks the wire protocol itself, so it cannot be handed the
`pg.Pool` better-auth runs on: `PgLive` opens its own connections, to the address `PgPool` was
configured with, and a process holds two pools where it used to hold one. The comment claiming
auth writes joined application transactions through the shared pool was never true — a
transaction reserves a connection `pool.query` cannot see — and is gone.

What else it changed is invisible to the compiler, because a `sql<T>` row type is a claim rather
than a check. `int8` now decodes to a JavaScript `bigint`, not a string: every `count(*)` read
here either casts `::text` or goes through `Number(…)`, which accepts both, and the row types say
`bigint` now. Timestamps still decode to `Date` — the changelog says epoch milliseconds; the
codec in `repos/effect` says otherwise, and the codec is what runs. An object is no longer sent as
JSON by itself, which nothing here relied on: every `jsonb` write is `JSON.stringify(…)::jsonb`.

`multiplex` is set to `false` rather than left to its default. Tenant scope is
`set_config('app.current_org', …, true)` inside a transaction, a transaction reserves its
connection whatever the flag says, and a client pipelining other fibers' statements onto shared
connections is exactly the arrangement this file refused Bun's Postgres client over.

## Do not touch `repos/`

- Never edit files under `repos/` unless explicitly asked.
- Never import from `repos/`. Application code imports from normal package dependencies.
- `no-relative-import-outside-package` and the `@/` alias are for intra-repo imports only.

Re-vendor a copy when its pinned version moves:

```
bun run vendor              # every source in scripts/vendor-sources.json
bun run vendor effect       # just one
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
`tsconfig.tools.json` covers them so `bun run check` type-checks them like everything else.

Two sets stay `.mjs`, and neither is an oversight:

- **`.claude/hooks/*.mjs`** run on every `Edit` and `Write`. They must start in milliseconds,
  and `tsx` adds a compile step to each invocation; `check-rules` also has to work when
  `node_modules` is broken, which is exactly when somebody is editing under pressure.
- **`scripts/oxlint-rules/*.mjs`** are loaded by oxlint itself, which reads JavaScript. There
  is no TypeScript to convert them to that oxlint could run.

## bun runs this, and the one place it does not

**bun is the package manager, the script runner and the runtime.** `bun install`,
`bun run dev`, `bun run test`; the API, the worker and the MCP server all boot under it
through `@effect/platform-bun`; every `.ts` in `scripts/`, `tooling/`, `e2e/` and `evals/`
is executed directly with no transpile step in front of it. `.bun-version` pins the
version, and it is the file CI reads.

**Everything runs in Bun, including the tools.** Every `vite`, `expo`, `playwright` and
`vitest` invocation is prefixed `bun --bun`, which forces the Bun runtime rather than
letting a `#!/usr/bin/env node` shebang hand the process to Node. `.nvmrc` is gone and CI
installs no Node at all.

Getting there took two corrections worth keeping, because both were the same mistake.

The first attempt concluded **vitest could not run in Bun**: it died with
`Worker exited unexpectedly` whatever the pool. Bisecting by project put the crash in
exactly one place — **jsdom**, whose `EventTarget` breaks under Bun inside vitest's
`catchWindowErrors`. The DOM environment is `happy-dom` now and all 502 tests run in Bun.

The second was assuming **Playwright and Vite had to stay on Node** because they are Node
programs. They are, and `bun --bun` runs them anyway: 67 browser tests, six image builds
and the Expo bundle all pass under it.

Both times a whole tool was written off for one dependency's incompatibility, because the
failure was read at the top of the stack instead of bisected. That is the note, rather
than a quiet correction.

One consequence is worth knowing before writing a test. `@effect/platform-bun` reaches for
the `bun` built-in module, so it can only be imported where the Bun runtime is — which is
now everywhere, but was not when `apps/server/test/api/v1/Handlers.test.ts` was written.
It provides `HttpPlatform.layer` over `FileSystem.layerNoop({})` rather than reaching for
a platform layer at all, and that is the better shape regardless: nothing on `/api/v1`
touches a file, so the runtime is not part of the question.

**The catalog moved into `package.json`.** bun keeps it at `workspaces.catalog`, so
`pnpm-workspace.yaml` is gone and the two things that read a pin — `SessionStart` and
`vendor-sources.test.ts` — read JSON now instead of matching YAML with a regex.

**Two `overrides` exist and both are load-bearing.** `@lucas-barake/effect-form` is forced
to `0.25.0-beta.6`: the range its `-react` package asks for is `^0.25.0-beta.6`, which
semver says includes the _stable_ `0.25.0` — and that one still targets Effect v3, so bun
resolving it (correctly) broke every form with `Cannot find module 'effect/dist/ParseResult.js'`.
pnpm had been conservative about prereleases and hidden it. `@effect/platform-node-shared`
is pinned to the same RC for the same class of reason: it once drifted four releases ahead
through a caret and expected an `effect` this repository did not have. Every `@effect/*` package
being on one RC is an invariant this repo has always depended on and had never written
down.

**`--workspace-concurrency=1` has no bun equivalent, and no longer needs one.** pnpm fanned
`build` out across packages, each starting its own `tsc -b`, and the race that caused is
described under Docker below. The build now does the types **once** — `tsc -b` over the
app's tsconfig, which follows project references — and then the bundles, which are
independent. Each deployable therefore has a `bundle` script that is the Vite half of its
`build`. The race is gone by construction rather than serialised around, which is the
better answer pnpm's flag was hiding.

**`apps/mobile` declares two packages Expo's own preset forgot.** `babel-preset-expo`
names `@babel/plugin-transform-react-jsx` and `react-native-reanimated/plugin` as strings
and does not list either as a dependency of its own. Under a hoisted install nobody
notices; under bun's isolated linker Babel resolves them from the app's `node_modules` and
they are not there, so `expo export` dies on `Cannot find module` — which is the linker
being right about a dependency nothing declared. Babel's own error message says to add
them to the manifest, and that is the fix: two entries, rather than hoisting the whole
workspace and losing the strictness that catches this everywhere else.

**Object storage is Bun's own client.** `S3Store.ts` was `@aws-sdk/client-s3` plus
`@aws-sdk/s3-request-presigner`, loaded through a dynamic `import` so a deployment without
credentials never paid for them; `Bun.S3Client` is in the runtime, so there is nothing to
load and two fewer dependencies to install. It covers exactly the four operations this
module needs — presigned PUT, presigned GET, `stat` for the size, `delete` — and `type` in
its presign options is what keeps the **content-type inside the signature**, which is the
part that stops an upload being served back as `text/html`.

**Redis and Postgres stay where they are, and both refusals have a reason.** Bun ships a
Redis client, and adopting it would mean _two_ clients in one process rather than one:
BullMQ requires ioredis and is not negotiable, so Bun's would be additional rather than
replacing. It also documents no Sentinel and no Cluster, and Effect's `Redis` service is
built on `SCRIPT LOAD` and cached `EVALSHA`, which its docs do not mention.

Bun ships a Postgres client too, and `@effect/sql-pg` is not a driver here — it is the seam
`withOrgScope`, `withWorkerScope`, every RLS policy and the typed `SqlError` classification
run through. Swapping it means writing a new Effect `SqlClient`, which is a rewrite of the
most consequential code in this repository for no visible gain. The specific risk is worth
naming: Bun creates named prepared statements for queries it infers are static, and tenant
isolation here depends on `set_config('app.current_org', …)` holding for the queries that
follow it on the same pooled connection. That is exactly where automatic statement caching
goes subtly wrong, and the failure mode is one tenant reading another's rows.

## One directory of skills and agents, three tools reading it

Skills live in **`.agents/skills`**. `.claude/skills` is a symlink to it, and
`.cursor/rules/*.mdc` and `.codex/SKILLS.md` are **generated** from it by `bun run
agents`. A skill is prose about _this_ repository; which agent reads it is not the skill's
business, and a per-tool copy is the failure this layout exists to avoid — two directories
of prose about the same code, one of which is quietly older and says nothing about it.

The generated views are **pointers, not copies**, for the same reason. A Cursor rule that
inlined a skill would be a second copy that keeps being loaded after it goes stale.

Nine skills are vendored — impeccable and the eight marketing ones, both Apache-2.0 — and
five are this repository's own: `product-development` is the method, and `better-auth`,
`effect-sql-rls`, `tanstack-start-ssr` and `effect-form-e2e` are the four areas where a
wrong edit is expensive and the reason is not visible from the code.

**`.agents/skills-lock.json` is the provenance**, written by hand rather than generated so
a reviewer sees it in the diff: where each skill came from, its licence, and the file that
licence lives in. `tooling/test/skills.test.ts` fails when a skill is present and unlocked,
when a lock entry has no skill behind it, when a vendored entry names a licence file that
is not there, when a description is too thin for an agent to route on, when `.claude/skills`
stops being a symlink, and when the generated views drift — including an orphaned rule left
behind by a deleted skill, which Cursor would otherwise keep loading.

It replaces a claim in `NOTICE` that was simply false: that the skills were "pinned in
package.json", where no such pin existed.

**Discovery starts with a grilling.** `grilling` and its `/grill-me` entry point are
vendored from `mattpocock/skills` (MIT), pinned to a commit in the lock, and
`/product-discover` invokes the first before writing anything. Discovery's failure mode is
not missing information, it is **misalignment** — two people agreeing on a sentence that
means different things to each, and finding out in the build phase. The skill works a plan
as a design tree, asks the whole settled frontier in one round with a recommended answer
for each, and will not act until the user says the understanding is shared.

Its sibling `to-spec` was considered and **not** vendored, which is worth recording because
the documentation made it look like a fit. Reading the source: it publishes to an issue
tracker, expects a triage vocabulary from `/setup-matt-pocock-skills`, and applies a
`ready-for-agent` label. This repository's discover phase writes a **committed `SPEC.md`**
instead, deliberately — a change to the scope deserves a diff and somebody's name on it.
Vendoring it would have shipped a skill telling people to run a command that does not exist
here.

The rest of that set — `tdd`, `code-review`, `diagnosing-bugs`, `implement`, `prototype` —
was declined for the reason the UI rule files were deleted: a second set of engineering
opinions beside `RULES.md`, the `/product-*` commands and the review subagents is the
precedence conflict this file exists to prevent, and the loser is the agent trying to work
out which one governs.

**Subagents live beside the skills**, in `.agents/agents`, with `.claude/agents` symlinked
to it and the same lock covering both. A skill is prose an agent reads; a subagent is worth
its own context window only when the work is **large, read-heavy and produces a short
answer**. That test is what keeps the list at eight rather than thirty.

Four are this repository's own. `design-sync` sweeps `apps/design`, `@vantion/ui` and the
shipped apps for the drift nothing else can see — a screen with no design screen, a prop the
fixtures stopped passing, a persona describing a permission the product does not have, which
has already happened once. `tenancy-review` checks new tables and queries against the
isolation rules and is required to name **the request that would exploit** each finding,
because a finding without that sentence is a guess. `contract-drift` follows a changed
contract to all four transports and both front ends, looking for what the compiler cannot
see — a hydration key, a reactivity key, the frozen wire types. `slice-gate` ranks a long
gate failure by what it means rather than the order it printed.

The other four are impeccable's, vendored and Apache-2.0 like the skill itself. They shipped
with it and nothing here had ever wired them up.

**Codex gets them as checklists, not as agents.** It has no subagent concept, so
`.codex/SKILLS.md` lists each one as a property worth checking and the order to check it in —
which is what they are anyway. Pretending the concept transfers would be worse than saying it
does not.

**`PRODUCT.md` and `DESIGN.md` are deliberately absent.** impeccable's `init` and
`document` write them, from a conversation about a product this template does not have.
Shipping a filled-in pair would hand every generated repository somebody else's answers to
questions only its own team can answer — the same reason `SPEC.md` exists here only as
`SPEC.md.example`.

## MCP servers, and the two that were dead

`.mcp.json` declares six: **vantion** (this repository's own toolkit, run from source),
**stripe**, **railway**, **playwright**, **context7** and **sentry**. Only playwright needs
no credential. `docs/mcp-servers.md` is the long version, including what is deliberately
absent and why.

Two things that file exists to prevent, both of which had already happened.

**Check the package is alive.** Two of the three servers originally wired here were
deprecated: `@railway/mcp-server` ("now bundled into the Railway CLI") and
`@modelcontextprotocol/server-postgres` ("no longer supported"). Both sat in the config
looking configured. Railway is `bunx railway mcp` now, against a CLI this repo already
depends on.

**Document the variable.** `RAILWAY_API_TOKEN` had never reached `.env.example`, so the one
thing a reader needed in order to use it was the one thing not written down.
`tooling/test/mcp.test.ts` fails when a server interpolates a variable `.env.example` does
not declare, when a server is not named in the doc, when one is started with `npx` rather
than bun, and when **vantion** points at `build/bundle` instead of source — an editor
answering from the last build is answering from code you are in the middle of changing.

**There is no better-auth MCP server.** `@better-auth/mcp` is a plugin for _building_ one
whose OAuth is better-auth's; wiring it here would be a misunderstanding committed to a
config file. What was actually wanted — version-correct docs for better-auth, TanStack
Start and the rest — is Context7.

**Postgres is deliberately absent.** Every live replacement is a third-party package that
wants `DATABASE_URL`, and handing a database credential to an unvetted dependency is not a
trade this repository makes. `psql` covers raw SQL, and the vantion server covers tenant
data _through_ the policies rather than around them.

## Hygiene, and what each tool is actually for

`bun run hygiene` is knip, syncpack and secretlint, and CI runs the same command rather than three
steps of its own — a failure there is reproducible by typing one thing.

- **knip** walks the import graph for unused files, exports and dependencies. Its first run
  removed 26 dependencies and 15 devDependencies that nothing imported, and seven catalog
  entries left behind with them. What it cannot see is in `knip.jsonc` with a reason beside it:
  some workspace dependencies exist only for `tsc -b` ordering, Metro and Tailwind resolve
  packages nothing imports, and `@lucas-barake/effect-form` must stay in the catalog because
  `vendor-sources.test.ts` asserts it is there.

  **Read its configuration hints rather than ignoring them.** They are advisory and easy to
  scroll past, and twenty of them accumulated — most were entries the tool had learned to
  resolve by itself, so the config was describing a version of knip that no longer existed.
  Clearing them is mostly deletion, and what it left behind was the interesting part: two
  `entry` patterns matching nothing, because `apps/mcp/test` and `packages/redis/test` were
  **empty directories**. A package with a test script, a vitest config and no tests looks
  exactly like a package with tests, in every summary anybody reads. Both have them now, and
  the config is silent.
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
`bun install --frozen-lockfile`, which is the first line of all six Dockerfiles, and the build
image carries no `git`; an unguarded `lefthook install` therefore failed every image build at
once while `bun run check`, `bun run lint` and the whole test suite stayed green. Nothing in CI built
an image, so the next thing to notice would have been a deploy. `.github/workflows/nightly.yml`
is the answer to that, and this is the break it was written for.

`.ignore` keeps `repos/` out of ripgrep, and therefore out of every agent search. Reading it
deliberately is the point and `rg --no-ignore` still does; having 3,558 vendored files in the
results of every unrelated query is attention spent for nothing.

`bun run preflight` is format, check, lint, hygiene and test in the order they should run, and
`bun run gate` is that plus e2e. Two names because they answer different questions: `preflight` is
the inner loop, run constantly, and putting a Postgres container and two servers behind it
would make the command typed twenty times a day cost what the one typed twice a day should.
`gate` is what a slice has to pass before it is called done.

Neither builds an image, which is deliberate and is why `build:images` is separate: six cold
builds is half an hour. What a build would have caught is covered instead by
`tooling/test/docker.test.ts` in the fast gate, by a single server image in CI, and by the
nightly matrix for the rest.

## Commands

|                                                 |                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `bun run dev`                                   | API server and the Start client together, in parallel              |
| `bun run build`                                 | deployable artifacts for the database, API and web packages        |
| `bun run check`                                 | `tsc -b` across all project references, then the config files      |
| `bun run lint`                                  | oxlint, incl. Effect type-aware rules and the local `app/*` plugin |
| `bun run format` / `format:check`               | dprint                                                             |
| `bun run test`                                  | vitest across `apps/*` and `packages/*`                            |
| `bun run e2e`                                   | Playwright, driving both servers in a browser                      |
| `bun run new:module <name>`                     | scaffolds `packages/modules/<name>` and registers it               |
| `bun run agents`                                | regenerates `.cursor/rules` and `.codex` from `.agents/skills`     |
| `bun run design`                                | the product-design app, on persona fixtures                        |
| `bun run --filter @vantion/tokens figma:script` | the Figma variable sync, printed                                   |
| `bun run services`                              | Postgres, Redis and Jaeger, via `docker compose`                   |
| `bun run db:migrate`                            | applies the migrations to `DATABASE_URL`                           |
| `bun run build:images`                          | all six deployable images                                          |
| `bun run fix`                                   | `format` then `lint:fix` — what to run before reading a diff       |
| `bun run e2e:install`                           | the one Playwright browser the suite needs, once                   |
| `bun run preflight`                             | format, check, lint, hygiene and test, in that order               |
| `bun run gate`                                  | `preflight` and then e2e — what a slice has to pass                |

The second half of `bun run check` is `tsconfig.tools.json`, which type-checks what
project references cannot: the Vite and Vitest configs, `vitest.shared.ts`,
`setupTests.ts`, and `alchemy.run.ts`. These are ordinary TypeScript that
nothing else compiles, so without it an error there surfaces only when the tool
that loads the file runs.

`bun run dev` reads the repo-root `.env` — copy `.env.example` and fill it in. The API server's
port is `PORT`; the client derives its own from `WEB_URL`, so the two cannot drift apart.

Postgres-backed tests need a database. They skip without one. Either `docker compose up -d`,
or point at an existing instance with `TEST_DB_URL=postgresql://...`.

`bun run e2e` is the browser suite in `e2e/`, and it needs nothing set up. It starts a Postgres
container of its own on a free port, applies the migrations, runs both servers on 3100 and
5273 so a running `bun run dev` is undisturbed, and removes the container afterwards even when
the run fails. `bun run --filter @vantion/e2e install-browsers` once, first.

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

`bun run build` compiles every package and bundles the two runnable entry points with Vite — the
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

`bun run dev` runs the three that make the product; `bun run dev:all` runs every app, which is
rarely what you want and occasionally exactly what you want. `bun run services:reset` is the one
to know the shape of: it takes the volumes with it, so it discards the database.

Each app owns a `Dockerfile`, built from the repository root, because a workspace package
resolves against the root lockfile and every sibling manifest:

```
docker build -f apps/server/Dockerfile -t vantion-api .
docker build -f apps/web/Dockerfile    -t vantion-web .
```

Every image, and `bun run build`, does the types **once** and then the bundles: `tsc -b` over
the app's own tsconfig, then `bun run --filter … bundle`. That split is not tidiness, it is a
race being removed.

`tsc -b` in one package builds the _projects_ of the packages it references, and several here
reference the same ones — `modules/agent` and `modules/assistant` both reference
`packages/database`. Fanned out across packages, two `tsc` processes write that project's
output and `.tsbuildinfo` at once while a third reads it half-written, which surfaces as
`error TS2306: File 'src/PgTest.ts' is not a module` on a file that is one. pnpm needed
`--workspace-concurrency=1` to stop it, and bun has no such flag — but with the type build
hoisted out there is only ever one `tsc`, so there is nothing left to serialise. The race was
always here; building the whole closure made it likely rather than rare, and it appeared in CI
while passing three times locally.

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
`bun run test`, and its failure prints the `COPY` lines to paste.

An image also has to **build what it depends on**, and that is what the `tsc -b` line does:
project references are followed, so naming the app builds every package it reaches. pnpm said
the same thing with a `...` suffix on the filter, which bun does not have and does not need.

A workspace package resolves to `build/src/*.js` under its `default` export condition, and
`.dockerignore` keeps build output out of the context, so a value imported from a module does
not resolve until something has built it. Type-only imports are erased and never notice, which
is why this surfaced on exactly one line: `MAX_UPLOAD_BYTES` in `routes/_protected/files.tsx`.

The same applies outside Docker. The nightly mobile job bundles with Metro, which resolves
`@vantion/tokens` through `default` as well, and a bare filter fails on
`Cannot find module '@vantion/tokens/build/src/color.js'`. A local run cannot catch either one,
because a working tree has the build output a fresh checkout does not.

Nothing in `bun run check`, `bun run lint` or the test suite builds an image, which is the gap
`.github/workflows/nightly.yml` covers: the mobile bundle and all six images, nightly, because
together they take longer than the rest of CI and a break in them does not block a merge.

Neither image carries `node_modules`, and both run on Alpine even though the build stage needs
Debian — `effect-tsgo` has no musl build, but nothing installs at runtime. The API image also
carries the migration runner, so a release applies migrations as its own step rather than at boot.

The web app builds through Nitro's Vite plugin, which turns Start's fetch handler into
`.output/server/index.mjs` — a server `node` runs directly, with no host to write.

**The browser talks to one origin: the web app's.** `apps/web` forwards `/api/auth/*`,
`/api/files/*` and `/rpc` to `apps/server` over the private network (`src/server/proxy.ts`), so
the session cookie is an ordinary first-party cookie on whatever host served the page. There is
no cookie domain, no cross-origin request and no API address compiled into the bundle — which is
what makes sign-in work on a generated `*.up.railway.app` host, in a Railway PR environment, on
`localhost` and on a custom domain alike, and one web image serve all of them.

It replaced the opposite arrangement, and the reason is worth keeping. The browser used to call
the API directly, which needed both hosts under one parent domain and `AUTH_COOKIE_DOMAIN` set to
it — a setting that fails silently when wrong (sign-in succeeds, the cookie is dropped, the page
bounces back) and that cannot be right at all on a public suffix, so no preview could sign in.
The cost of the proxy is one private-network hop per request, which is cheaper than a domain per
environment.

Three details are load-bearing. The proxy passes `X-Forwarded-For` through **untouched**: Railway's
edge wrote the caller's address as the rightmost entry and the rate limiter counts exactly that
one, so appending this server's view would put every caller in one bucket — `rate-limit.spec.ts`
proves the limit per caller through the web origin. The API's routes the browser reaches live
under `/api`, because a splat at `/files/$` also matched the product's own `/files` page and
forwarded it to the API. And in development Vite forwards the same prefixes itself, through a
plugin listed first: Nitro's dev server relays request bodies through its own proxy, and a
browser cancelling an in-flight RPC — which Effect does to a superseded call — surfaced there as a
server error painted over the page. `test/server/proxy.test.ts` holds the build's proxy to the
contract the dev one follows.

`AUTH_BASE_URL` on the API is therefore the web origin, and defaults to `WEB_URL`: better-auth
builds every link it sends from it, and every link must come back through the proxy. The public
API (`/api/v1`) and Stripe's webhook stay on the API's own host — they authenticate by key and
signature, and an integration should not depend on the web app being up.
`VITE_AUTH_BASE_URL` and `AUTH_COOKIE_DOMAIN` remain as an explicit opt-out, for an admin panel on
a sibling subdomain that needs the same session.

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

**Directory provisioning is the other half of that purchase**, and `@better-auth/scim` is
what serves it — pinned to better-auth's own minor, for the reason the SSO plugin is. Single
sign-on decides _who may sign in_; SCIM decides _who exists_, so somebody removed from a
customer's directory on a Friday loses access without anybody here being told. That is the
half SSO cannot do and the half a security review asks about.

Users only. Groups are not provisioned, so **roles stay ours to set** — an identity provider
that could mint admins would make the organization's permission model a property of somebody
else's directory, which is the same reason `organizationProvisioning.defaultRole` is `member`.

Three of the plugin's defaults are changed and each is a security decision. `storeSCIMToken`
is **`hashed`** rather than its default `plain`, because a credential able to create and
disable users across an organization has no business being readable in the database — the
honest cost is that "rotate" becomes remove-and-generate, which the screen says. Personal
tokens are **refused** by `canGenerateToken`: the plugin allows an organization-less token to
any authenticated user, and there is no personal directory in a B2B product for one to belong
to. `linkExistingUsers` stays **off**, or a SCIM token could claim an account whose email
happens to match — one it never provisioned, possibly in another tenant.

**The seat limit had to be added, and where it sits is the lesson.** `membershipLimit` guards
better-auth's _invitation_ endpoints; SCIM inserts a `member` row through the adapter
directly, so a directory of five hundred people fills an organization sold three seats and
nothing says no. The first version checked it in a `before` hook on `/scim/v2/Users`, reading
the organization out of the bearer token — which works, and which answered a **forged** token
with "no seats left" instead of "unauthorized". A test pinned that, and the check moved into
`databaseHooks.user.create.before`, where `authenticatedScimOrganization` reads the provider
the plugin has already verified. Blocking the user is sufficient because linking is off: a
SCIM request that adds somebody to an organization is always one that creates them.

A provisioned account also gets a **personal organization**, because every account here does
and that hook is unconditional. Worth knowing before a directory of five hundred arrives.
`docs/scim.md` has the rest, including that no real identity provider has been pointed at
this repository either.

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

**All of that shipped a year before anything could reach it.** `Endpoints.register` had no
caller outside the tests, so a tenant had no way to say where to deliver — a whole module,
proven end to end, that only the test suite used. `/settings/webhooks` is the half that was
missing: the list, the attempts, and a form to add one. `docs/webhooks.md` is the longer
version of everything below.

**The URL check is the sharp edge, not the form.** A webhook endpoint is a URL a _customer_
chooses and a _server of ours_ then fetches, which is the definition of server-side request
forgery: unchecked, `http://169.254.169.254/latest/meta-data/iam/` is a valid endpoint and the
worker will fetch the instance's own cloud credentials and post them to whatever is registered
next. `DeliverableUrl.ts` refuses plain HTTP — a signature stops a body being changed, not
read — and refuses private, loopback and link-local hosts. `http://localhost` is the one
exception, off under `NODE_ENV=production`, because the first thing anybody does with this is
point it at a receiver on their own machine.

Its limit is stated as a test rather than left to be inferred: **the check runs on the string,
before DNS**, so a hostname resolving into private space passes and is fetched anyway. Closing
that means refusing the connection rather than the string — egress rules on the worker — and
this is the cheap half.

The rule lives in `EndpointFields` in the contract, which is what `RegisterEndpoint`'s payload
is built from _and_ what the form validates with, so the screen and the procedure cannot
disagree about it.

**The secret never reaches a page.** `ListEndpoints` names its columns instead of taking
`select *`, and that is the whole of it: hydration serialises what a screen reads into the
document, so a wildcard would put every tenant's signing key into the HTML on every visit. A
test asserts the list carries no `whsec_`. It is returned exactly twice — created, and rotated
— and shown once each time. Rotating keeps the endpoint because the attempts recorded against
it are what somebody is looking at when they decide to rotate, and there is **no overlap
window**: the next delivery is signed with the new secret.

**Reading is never gated on the plan; only registering is.** An organization that downgraded
still needs to know why deliveries stopped and still needs to rotate a secret it believes has
leaked — taking that away would make a lapsed plan a security problem, the same reasoning that
leaves a `canceled` subscription on the free plan rather than on nothing.

`WebhooksApi` is exported separately from `WebhooksModule`, and the compiler is what says so:
these handlers require `AuthMiddleware`, which exists only where there is a caller, and
`apps/worker` has none. Folding them together would make the module unregisterable in the one
process that does the delivering — the same split `IamModule`/`IamHttp` makes.

Uploads never pass through this application. `RequestUpload` signs a URL, the browser PUTs the
bytes at it, and `CompleteUpload` asks storage how big the object actually is — because a client
saying "done" is a claim, and the size in the request was only what somebody intended to send. A
row is written before the bytes exist, `pending`, since a presigned URL names a key and a key
nobody has recorded against a tenant is an object with no owner.

Keys are generated and never accepted: `${organizationId}/${uuid}`, with the caller's filename
kept as display text only. The prefix means a bucket policy can be written against it, so a
mistake is caught by storage as well as by row-level security.

Without `S3_BUCKET` and `S3_ACCESS_KEY_ID`, uploads go to `FILES_DIR` and the API serves them
from `/api/files/*` — signed, expiring, and authorised by the signature alone, since the point of
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

`alchemy.run.ts` describes the whole deployment as an [Alchemy](https://alchemy.run) stack: a
Railway Project per stage, its Postgres and Redis, and all five services — their Dockerfiles,
health check, watch patterns, and the variables wiring them together. It replaced a
`railway/iac` file in the move to Effect rc.117, which Alchemy needs; `docs/deploy.md` is the
long version.

**A stage is a Project, not an environment inside one.** `staging` and `prod` share nothing, so
`destroy` on one cannot reach the other, and a Railway PR environment copied from staging holds
staging's credentials. Any other stage is refused rather than created, because the CLI's
default is `live_$USER` and a Project per person deploying `main` is a bill.

**State lives in a Postgres outside everything the stack creates** — `ALCHEMY_STATE_DATABASE_URL`
— or `destroy` would delete its own record halfway. Its advisory lock per stage is what makes
two applies unable to interleave.

**Secrets are the deploying environment's**, not the dashboard's: read at deploy time from the
GitHub environment and written to Railway, so a value set by hand is overwritten by the next
deploy. That is the opposite of the `preserve()` it replaced, and it is why a laptop deploy is
the wrong one — the CLI layers the developer's `.env` under the environment.

`.github/workflows/deploy.yml` plans on a pull request and applies after `ci` passes on a push
to `staging` or `main`, against the commit that passed; `production` has a required reviewer.
The plan runs the pull request's `alchemy.run.ts` with staging's credentials, which is the
price of a plan on every pull request and why production is never used for one.

**Watch patterns are derived, not listed.** Each is every workspace package the image installs,
from `tooling/DockerManifests.ts` — the function `docker.test.ts` holds the `COPY` lines to. The
hand-written lists had drifted to three directories for an image that depends on eighteen, so
a change to a module never redeployed the API on its own.

Writing it found three variables the old file had wrong. The API reads S3, OpenRouter and the
assistant model and was given none of them; the worker, which registers only the jobs and
webhooks modules, was given all three. And the web service's private route to the API — which this
file said existed — was never set, so every server-rendered page called the API through the
public edge. It is `API_URL` now, the same address the web service's proxy forwards to. `api.<domain>` and `app.<domain>` are resources now, too:
Railway's runner rejected a `domains` entry outright.

The worker carries no domain and no health check because it serves nothing, and it does not
run migrations — the API's `preDeploy` does, and two services migrating one database is the
race that step exists to avoid. The API's `WEB_URL` must be the web service's public URL,
because `Auth.ts` passes it to better-auth as a trusted origin and a browser POST from any other
origin is refused outright.

Hostnames are a choice rather than a constraint: because the browser only talks to the web
service's origin, a stage signs in on its generated hosts exactly as it does on its own domain,
and so does a Railway PR environment copied from staging.

Alchemy is a beta, and its Railway provider was about a month old when this was written; the
version is pinned exactly for that reason. Its `Railway` barrel is imported by file rather than
whole, because the barrel re-exports framework composites that import an optional peer bun's
isolated linker rightly does not install.

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

`VITE_` matters here because Vite substitutes
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

`/account/security` is where anybody enrols, and `/auth/two-factor` is the step a sign-in
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
DATABASE_URL=postgresql://... bun run --filter @vantion/database migrate
```

Every migration is idempotent and there is no ledger, so applying the whole set to any database
converges it on the committed schema. `packages/database/test/Migrations.test.ts` is what holds
that property honest — it applies them twice.

## Full rules

`RULES.md` holds the hard repository rules — Effect style, architecture, forms, notifications,
observability, testing, commits. Read it before making changes. `knowledge/README.md` indexes
the per-topic guides.
