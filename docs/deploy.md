# Deploying

`alchemy.run.ts` is the whole deployment: a Railway Project per stage, its Postgres and
Redis, and the five services built from this repository's Dockerfiles. It is an
[Alchemy](https://alchemy.run) stack — infrastructure as an Effect program, planned and
applied by a CLI — and `.github/workflows/deploy.yml` is what applies it.

```
bun run deploy:dry-run                  # what each stage is made of — no token, no network
bun run deploy:plan --stage staging     # what would change on Railway
bun run deploy --stage staging          # change it
bun run deploy:destroy --stage staging  # remove all of it, database included
```

## A dry run without Railway

`alchemy plan` is not offline. Before it plans a create, the engine asks each provider whether
the resource already exists, so it can adopt rather than duplicate — and for Railway that is
an API call with a token.

`bun run deploy:dry-run` runs the same stack through Alchemy's real engine — plan and apply —
against stand-in providers (`tooling/OfflineRailway.ts`) that report nothing as existing and
record what they were asked to create. It needs no token, no state database and no network,
and prints every resource each stage would be made of, with secrets masked and references left
as the `${{…}}` templates Railway would receive. It runs from an empty directory with the
declared variables cleared, because the engine reads `.env` beneath the environment and an
empty variable does not mask it: without that, a developer's own S3 region would appear as if
the stage had one.

`tooling/test/deploy-offline.test.ts` runs it on every `bun run test` and holds the result to
what must not drift: the resources, that Postgres and the worker are not public, that every
`${{service.VAR}}` names a service that exists — Railway resolves a misspelt one to an empty
string rather than failing — and that each secret reaches only the process that reads it.

What it cannot tell you is whether Railway would accept the result: a name already taken, a
token without the right scope, a repository the account is not connected to. That is
`deploy:plan`, with a token.

## Stages

Two, and a stage is a **Project**, not an environment inside one:

| Stage     | Branch    | Project           | Applied by                               |
| --------- | --------- | ----------------- | ---------------------------------------- |
| `staging` | `staging` | `vantion-staging` | a push to `staging`, once `ci` passes    |
| `prod`    | `main`    | `vantion-prod`    | a push to `main`, once `ci` passes and a |
|           |           |                   | reviewer approves the `production` job   |

Separate Projects share nothing — no variables, no private network, no volume — so
`destroy` on one cannot reach the other, and a preview copied from staging (below) holds
staging's credentials rather than production's.

Any other stage is **refused**. `alchemy deploy` with no `--stage` defaults to
`live_$USER`, and a whole Project per person deploying `main` is a bill nobody asked for.
Adding a stage is a line in `targets`.

## State

Alchemy records what it deployed, and that record lives in **a Postgres of its own**:
`ALCHEMY_STATE_DATABASE_URL`, outside every Project the stack creates. Kept inside one,
`destroy` would delete the record of what it was destroying halfway through. Anything
works — a small Neon database, a separate Railway project — and only the deploying machine
needs it.

The store takes a Postgres advisory lock per stack and stage, so two applies of one stage
cannot interleave; the workflow also queues them, and never cancels one halfway.

## Secrets

**The deploying environment is the source of truth.** Every secret a stage uses is read
when the stack runs — GitHub environment secrets in CI — and written to Railway as a service
variable. That is the opposite of the `railway config apply` this replaced, which left
secrets alone (`preserve()`) for somebody to set in the dashboard: here a value set by hand
in the dashboard is overwritten by the next deploy.

`AUTH_SECRET` and `RESEND_API_KEY` are required; a stage without them does not plan. The
rest are optional, and an unset one writes no variable at all rather than an empty one.
`deploy.yml` lists exactly which it passes.

**Deploy from CI, not a laptop.** The CLI layers `.env` under the environment, and the
`.env` on a development machine holds development values — so `bun run deploy --stage prod`
there would push a local `AUTH_SECRET` to production. If a local deploy is genuinely needed,
pass `--env-file` naming a file that holds that stage's values and nothing else.

## Setting it up

1. **A Railway token**: an account or workspace token, not a project token — a project token
   cannot create projects. The account needs a GitHub connection to this repository, since
   every service is built from it.
2. **A state database**, anywhere outside Railway's projects for this stack.
3. **Two GitHub environments**, `staging` and `production`, each holding
   `RAILWAY_API_TOKEN`, `ALCHEMY_STATE_DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY` and
   whichever optional secrets that stage uses. Give `production` a required reviewer.
   Leave `staging`'s deployment branches unrestricted: pull requests plan against it.

## What CI does

- **A pull request** that touches the stack or a Dockerfile gets `alchemy plan` for staging,
  in the job summary. Nothing is written.
- **A push to `staging` or `main`** is applied once `ci` has passed on that commit, and
  against that commit rather than wherever the branch points by then.

Two trade-offs are worth knowing rather than discovering:

**The plan runs the pull request's code with staging's credentials.** A plan evaluates
`alchemy.run.ts`, so anybody who can push a branch here can read staging's secrets. Forks
cannot — they get no secrets and the job is skipped — and `production` is never used for a
plan. That is the price of a plan on every pull request.

**Infrastructure and code deploy side by side.** The workflow applies services and variables;
Railway builds the code itself, from each service's GitHub source, on the same push. A push
that changes both can start a build before its new variables land. Railway redeploys when a
variable changes, so it converges. If that stops being good enough, two ways out: turn on
**Wait for CI** on each service so Railway builds only after checks pass, or build images in
CI and point each service at an image rather than the repository.

## Domains

Until a stage has a domain, both public services use generated `*.up.railway.app` hosts.
That boots, but **nobody can sign in**: the browser calls the API directly, so the session
cookie crosses origins, which needs both under one parent with `AUTH_COOKIE_DOMAIN` scoped
to it — and `up.railway.app` is a public suffix, so two generated hosts can never qualify.

Set `domain` on the stage in `targets` and the stack creates `app.<domain>` and
`api.<domain>`, sets `AUTH_COOKIE_DOMAIN`, and reports the DNS record Railway needs for
each. The old Railway config could not create domains at all; that was a dashboard step.

## Preview environments for a pull request

Deliberately **not** Alchemy stages. A stage per pull request is a whole Project — Postgres,
Redis, five services — per open PR, and it still could not sign in.

Railway's own PR environments still work, as a dashboard toggle on **`vantion-staging`**:
**Project Settings → Environments → Enable PR Environments**. Because staging is its own
Project, a preview copies staging's variables and credentials, never production's. Turn
**Focused PR Environments** on — every service has `watchPatterns`, derived from its
Dockerfile, which is what it reads — and **Bot PR Environments** off, or each Dependabot
bump raises a full stack.

Alchemy does not know about those environments, and does not need to: they are Railway's
copies of a Project it manages. Sign-in there has the same public-suffix problem as above,
so the preview that is complete rather than half-working is `apps/design`, which has no
session to fail.

## Before the first deploy

Things this configuration has not been exercised against, to check on staging first:

- **`DATABASE_SSL=true` against Railway's Postgres.** Its image serves a self-signed
  certificate, and a client that verifies it will refuse the connection. If the API cannot
  reach the database, that is the first place to look.
- **The web image's build argument.** `VITE_AUTH_BASE_URL` reaches the client bundle only if
  Railway passes the service variable to the Dockerfile's `ARG`. Search the served JavaScript
  for the API's host, not `localhost`.
- **Row-level security.** `DATABASE_URL` is Railway's bootstrap user, which is a superuser;
  under it every policy in this schema is inert. `packages/database/src/roles/init.sql`
  creates the `vantion` role the application is meant to connect as, and nothing runs it on
  Railway yet.
