# Preview environments for a pull request

Railway can build a whole copy of the project for every pull request — services, Postgres,
Redis, variables — and tear it down when the PR closes. It is the closest thing to a
staging environment that costs nothing between reviews.

Read this before switching it on. Most of it works out of the box; **one thing does not**,
and it is the thing a reviewer will try first.

## Switching it on

It is a dashboard setting, not config-as-code: **Project Settings → Environments → Enable
PR Environments**. `.railway/railway.ts` cannot express it — the IaC schema has no field
for it — so the file below stays as it is and the toggle lives with the project.

Two settings beside it are worth a decision rather than a default:

- **Focused PR Environments** deploys only the services whose watch paths a PR touched.
  Turn this on. `.railway/railway.ts` already gives every service `watchPatterns`, which is
  exactly what it reads, so a PR touching `apps/web` will not rebuild the worker.
- **Bot PR Environments** decides whether Dependabot's PRs get one. Turn this **off**.
  `.github/dependabot.yml` opens PRs for GitHub Actions on a schedule, and a full stack —
  three services, a Postgres and a Redis — for a bumped action version is a bill for
  nothing.

## What already works

**Variables follow the environment.** `.railway/railway.ts` wires the services to each
other with Railway reference variables rather than literals — `WEB_URL` is
`https://${{web.RAILWAY_PUBLIC_DOMAIN}}`, `AUTH_BASE_URL` is the API's own. In a PR
environment those resolve to that environment's hosts, so the API trusts the preview web
app's origin and the preview web app calls the preview API. Nothing to change.

**Migrations run themselves.** The API's `preDeployCommand` applies them, so the PR's fresh
Postgres arrives at the committed schema before the service starts. Migrations here are
idempotent and have no ledger, which is what makes that safe on a database that has never
been touched.

**Secrets are inherited** from the base environment. They are `preserve()` in the config —
this file plans no change to them — so a preview gets the same `AUTH_SECRET`, Stripe key and
so on that the base environment has. Worth knowing rather than discovering: **a preview
environment holds production credentials** unless the base environment you copy from is a
staging one with its own. Point PR environments at `staging` if you have one.

## What does not work: signing in

**A reviewer cannot sign in to a preview unless you own a wildcard domain.**

Railway gives each service in a PR environment its own generated host — something like
`web-pr-42.up.railway.app` and `api-pr-42.up.railway.app`. The browser sends a session
cookie between two origins only when it considers them same-site, which needs both under
one parent with `AUTH_COOKIE_DOMAIN` scoped to it. **`up.railway.app` is a public suffix**,
so two generated hosts can never qualify, however they are configured. The sign-in succeeds,
the cookie is dropped, and the app bounces back to `/auth/sign-in` looking broken.

This is the same constraint `.railway/railway.ts` documents for a split production
deployment; a preview just makes it unavoidable, because generated hosts are all a preview
has by default.

Three ways out, in the order they are worth considering:

1. **A wildcard custom domain you own.** Point `*.preview.example.com` at Railway and give
   each environment's services a host under it, with `AUTH_COOKIE_DOMAIN=.preview.example.com`.
   The only option that makes a preview behave like the real thing.
2. **One origin.** A preview that serves both halves from a single host has no cross-origin
   problem at all — a reverse proxy in front, `AUTH_COOKIE_DOMAIN` empty. More work to set
   up, and it is not how production is deployed here, so it tests a shape you do not ship.
3. **Accept it.** Preview the surfaces that need no session — `apps/marketing`,
   `apps/brand`, `apps/design` — and review the product against a local `bun run dev` with
   `bun run seed`. Free, honest, and enough for most pull requests.

`apps/design` is worth calling out for option 3: it has no backend, no session and no
network, so its preview is complete rather than half-working. For a PR that is mostly a UI
change, it is the preview that actually answers the question.

## Cost

A PR environment runs a Postgres, a Redis and up to three services for as long as the PR is
open. Focused environments cut that to the services a PR touches, but the databases come up
regardless. On a repository where PRs stay open for days, check the bill before assuming
this is free.
