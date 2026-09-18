# Days 25–30 · Ship

## The checklist

Do not deploy while any of these is untrue. Say which one, and fix it.

- [ ] `pnpm check && pnpm lint && pnpm format:check && pnpm test && pnpm e2e` all pass
- [ ] every tenant-owned table added this sprint has a row-level security policy
- [ ] `e2e/tests/tenancy.spec.ts` still passes with the new tables in place
- [ ] no secret is committed; `.env.example` documents every variable the app reads
- [ ] `TRUST_PROXY` matches the number of proxies actually in front of the API —
      it defaults to `0`, and Railway needs `1`
- [ ] migrations apply twice without complaint (`packages/database` tests this)

The isolation test is the one that matters. Every other failure is a bug; that
one is a breach.

## Deploying

```
railway config plan     # read the diff
railway config apply
```

`.railway/railway.ts` describes the whole project — database, services,
variables, health checks — so a deployment is reviewable the way a pull request
is. Two lines change on a fork: the repository and the project name.

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
- Landing copy, if the client has no site yet

## Closing

Update `STATE.md` to closed, and write the two things worth knowing next time:
what took longer than expected, and what was cut and never missed.
