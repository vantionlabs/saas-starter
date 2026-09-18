---
description: Build the feature list in vertical slices, each one green before the next.
argument-hint: "[the feature]"
---

Run the build phase for: **$ARGUMENTS**

Read `docs/workflow/03-build.md` and follow it, and read `RULES.md` before
writing anything.

Work in **vertical slices**, one feature at a time, and do not start the next
until the previous passes `pnpm check && pnpm lint && pnpm test` — plus `pnpm e2e`
when the slice touched a route or a handler. A slice that compiles is not a slice
that works.

For a new feature area, `pnpm new:module <name>` scaffolds the package and
registers it. Then, per `RULES.md`: one file per operation built with
`toLayerHandler`, an `*RpcLive.ts` that only merges them, a `Module.ts` root
layer, and — for anything tenant-owned — a row-level security policy in the style
of `0002_rls.sql` _and_ `withOrgScope` around the queries. Both, never either.

Read `repos/effect` before using an Effect API you have not already read this
session. It outranks `RULES.md`, `knowledge/` and your recall, in that order.

Update `docs/workflow/STATE.md` after each slice lands.
