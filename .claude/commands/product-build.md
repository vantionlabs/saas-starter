---
description: Build the feature list in vertical slices, each one green before the next.
argument-hint: "[the feature]"
---

Run the build phase for: **$ARGUMENTS**

**Read `docs/workflow/SPEC.md` first.** Its §5 is the slice table: take the
topmost row that is not `landed`, mark it `building`, and build that row rather
than what the conversation suggests. If there is no spec, discovery has not
finished — run `/product-discover` instead of guessing the scope, because a
feature list improvised at build time is how a cut item returns.

A row's **tenant-owned** column is binding. _Yes_ means a row-level security
policy in the style of `0002_rls.sql` **and** `withOrgScope` around every query —
both, never either — plus a case in `e2e/tests/tenancy.spec.ts`. Its **shown by**
column names what must exist before the row is `landed`.

Work outside the table only for a defect or something the gate demands. Anything
else is scope, and scope belongs in the spec with a reason beside it — edit §5 or
§7 and say why, rather than absorbing it quietly.

Then read `docs/workflow/03-build.md` and follow it, and read `RULES.md` before
writing anything.

Work in **vertical slices**, one feature at a time, and do not start the next
until the previous passes `bun run check && bun run lint && bun run test` — plus `bun run e2e`
when the slice touched a route or a handler. A slice that compiles is not a slice
that works.

For a new feature area, `bun run new:module <name>` scaffolds the package and
registers it. Then, per `RULES.md`: one file per operation built with
`toLayerHandler`, an `*RpcLive.ts` that only merges them, a `Module.ts` root
layer, and — for anything tenant-owned — a row-level security policy in the style
of `0002_rls.sql` _and_ `withOrgScope` around the queries. Both, never either.

Read `repos/effect` before using an Effect API you have not already read this
session. It outranks `RULES.md`, `knowledge/` and your recall, in that order.

**When a slice does not look like the code already here, read
`knowledge/rules/effect-reach-for.md` before writing it.** This repository uses
about twenty of Effect's hundred and twenty modules, because a boilerplate has a
boilerplate's problems — a product has others. That file is keyed on what you
are about to do rather than on module names: bounding concurrency, caching a
decision, batching an N+1, a process that must survive a restart, a script with
arguments. The failure it prevents is writing four hundred lines of something
that is one import.

When a slice lands, set its row to `landed` in the spec and update
`docs/workflow/STATE.md`. The spec is what the work is; `STATE.md` is where it
got to.
