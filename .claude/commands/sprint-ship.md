---
description: Days 25-30. Deploy it, prove it works, and write what it is.
argument-hint: "[environment: staging | production]"
---

Run the ship phase of the 30-day sprint for: **$ARGUMENTS**

Read `docs/sprint/04-ship.md` and follow it.

**Refuse to ship if any of these is untrue**, and say which:

- `pnpm check && pnpm lint && pnpm format:check && pnpm test && pnpm e2e` all pass
- every tenant-owned table added this sprint has a row-level security policy
- the tenant-isolation test in `e2e/tests/tenancy.spec.ts` still passes with the
  new tables in place
- no secret is committed, and `.env.example` documents every variable the app
  now reads

Then: `railway config plan` and read the diff before `railway config apply` —
that file describes the whole project, and a plan is reviewable the way a pull
request is. Check `TRUST_PROXY` matches the number of proxies actually in front
of the API; it defaults to 0 and Railway needs 1.

Finally write what shipped: a changelog entry, the OpenAPI document published,
and the landing copy. Update `docs/sprint/STATE.md` to closed.
