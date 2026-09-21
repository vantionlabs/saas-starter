# Contributing

Thanks for helping. This is a starter: it exists so that the first two weeks of
a B2B SaaS product are already done and already tested. The bar for a change is
whether it makes a project start faster **without adding a concept someone has
to learn** — a starter that needs its own documentation to be useful has stopped
being one.

## Good contributions

- A bug in tenant isolation, the permission model, rate limiting or API-key
  handling. These are inherited by everything built from this repo, so they are
  worth more than any feature.
- A test that catches a real failure, especially in `e2e/`. A case the code gets
  wrong is more useful than one it gets right.
- Something that was wrong or missing when you set it up. The README and
  `AGENTS.md` claim a fresh clone works with one secret filled in; if that was
  not your experience, that is a bug.
- Corrections to `RULES.md` or `knowledge/` where they contradict
  `repos/effect`. The vendored source is the authority and the docs go stale
  against it — see the precedence list in `AGENTS.md`.

Open an issue before something larger, such as a second frontend, an ORM, or a
new deployment target.

## Making a change

1. Read [AGENTS.md](AGENTS.md) for the layout and [RULES.md](RULES.md) for the
   hard rules. They are short, and they are what keeps the codebase one thing
   rather than several.
2. Read `repos/effect` before writing Effect code. Effect v4 is a release
   candidate whose APIs moved recently, so recall — yours or an agent's — is not
   reliable here.
3. `bun run check && bun run lint && bun run format:check && bun run test` must pass.
   `bun run e2e` too, if you touched a route, a handler or anything under `apps/`.
4. New tenant-owned tables need a row-level security policy in the style of
   `0002_rls.sql`, and their queries need `withOrgScope`. Both, not either.
5. Keep test coverage at or above 80%, and treat that as a floor rather than a
   target — a redundant test bought to move the number is a cost, not a
   contribution.

## How review works

`main` is protected. Everything lands through a pull request that CI has passed,
and nothing force-pushes.

**CI runs on your fork's pull request with a read-only token and no secrets.**
That is deliberate and it is what makes a public template safe to accept
contributions to: every workflow here is triggered by `pull_request`, never
`pull_request_target`, so nothing you push can read a credential or write to this
repository. Third-party actions are pinned to commit SHAs rather than tags, for
the same reason — a tag can be moved, a SHA cannot.

The consequence for you: **CI cannot do anything that needs a key.** If a change
needs Stripe, Resend, S3 or a model provider to prove itself, say so in the pull
request and describe what you ran locally, because the green tick will not have
covered it.

A first-time contributor's workflow run needs a maintainer to approve it. That is
one click and not a judgement on the change.

## Where a review will be slow

Some paths carry a `CODEOWNERS` entry, and it is not gatekeeping — it is where a
well-meaning change is expensive in a way the diff does not show:

- **`packages/database/src/migrations/`, `roles/`, `OrgScope.ts`, `modules/iam`,
  `modules/admin`** — tenant isolation. A wrong edit is a breach, not a bug, and
  the failure is silent. Expect questions about the policy's `using` _and_
  `with check`, and about the case in `e2e/tests/tenancy.spec.ts`.
- **`.github/`** — what runs in CI, with a token, on somebody else's pull
  request.
- **`.agents/`, `.claude/`, `AGENTS.md`, `RULES.md`** — what every agent is told
  and what the hooks refuse. A change here reaches every repository generated
  from this one.
- **`repos/`** — vendored upstream source. Never edited by hand; re-vendored with
  `bun run vendor`.

## Reporting something security-related

Do not open an issue. [SECURITY.md](SECURITY.md) has the address. Anything that
lets one tenant reach another's data goes there first, always.

## Commits

Lowercase, concise, no conventional prefixes, no AI attribution. Say what the
change does and, where it is not obvious, why. Pull request descriptions stay
short.
