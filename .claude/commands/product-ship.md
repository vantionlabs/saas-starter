---
description: Deploy it, prove it works, and write what it is.
argument-hint: "[environment: staging | production]"
---

Run the ship phase for: **$ARGUMENTS**

Read `docs/workflow/04-ship.md` and follow it.

**Refuse to ship if any of these is untrue**, and say which:

- `bun run check && bun run lint && bun run format:check && bun run test && bun run e2e` all pass
- every tenant-owned table added has a row-level security policy
- the tenant-isolation test in `e2e/tests/tenancy.spec.ts` still passes with the
  new tables in place
- no secret is committed, and `.env.example` documents every variable the app
  now reads

Then: `bun run deploy:plan --stage staging` and read the diff — `alchemy.run.ts`
describes the whole deployment, the pull request shows the same plan, and a merge
applies it once CI passes. Check `TRUST_PROXY` matches the number of proxies actually in front
of the API; it defaults to 0 and Railway needs 1.

Finally write what shipped: a changelog entry, the OpenAPI document published,
and the landing copy. Update `docs/workflow/STATE.md` to closed.
