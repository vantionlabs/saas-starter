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

## Commits

Lowercase, concise, no conventional prefixes, no AI attribution. Say what the
change does and, where it is not obvious, why. Pull request descriptions stay
short.
