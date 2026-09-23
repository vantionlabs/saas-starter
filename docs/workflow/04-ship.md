# Ship

## The checklist

Do not deploy while any of these is untrue. Say which one, and fix it.

- [ ] `bun run check && bun run lint && bun run format:check && bun run test && bun run e2e` all pass
- [ ] every tenant-owned table added has a row-level security policy
- [ ] `e2e/tests/tenancy.spec.ts` still passes with the new tables in place
- [ ] no secret is committed; `.env.example` documents every variable the app reads
- [ ] `TRUST_PROXY` matches the number of proxies actually in front of the API —
      it defaults to `0`, and Railway needs `1`
- [ ] migrations apply twice without complaint (`packages/database` tests this)

The isolation test is the one that matters. Every other failure is a bug; that
one is a breach.

**Before the checklist, a design pass.** `impeccable audit` runs the technical
checks — accessibility, theming, responsive behaviour, performance — and
`impeccable polish` does the final alignment and spacing pass. Both read the
`PRODUCT.md` and `DESIGN.md` that `init` and `document` wrote in the prototype
phase, so neither is useful until those exist. `docs/workflow/00-overview.md` has
the table of what to run once and when.

Neither is in the checklist above, because a design finding is a judgement and
the checklist is things that are simply true or false.

## Deploying

```
bun run deploy:plan --stage staging     # read the diff
```

`alchemy.run.ts` describes the whole deployment — a Project per stage, database,
services, variables, health checks — and `.github/workflows/deploy.yml` applies
it: a pull request gets the plan, a push to `staging` or `main` is applied once
CI passes. A deployment is reviewable the way a pull request is.
`docs/deploy.md` is the long version.

Migrations run as their own step, never at boot: two instances starting together
would both migrate.

One thing to know before choosing hostnames. The browser talks to the API
directly, so the session cookie only flows if both are _same-site_ — one parent
domain, with `AUTH_COOKIE_DOMAIN=.example.com`. That parent cannot be a public
suffix, and `up.railway.app` is on the list, so two generated Railway hosts can
never share a session. Splitting the services there needs a domain of your own.

## Writing what shipped

- A changelog entry saying what it does, not what was refactored
- The OpenAPI document at `/api/v1/openapi.json`, published
- Landing copy, if there is no site yet

## Closing

Update `STATE.md` to closed, and write the two things worth knowing next time:
what took longer than expected, and what was cut and never missed.
