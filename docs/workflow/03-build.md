# Build

One vertical slice at a time, from the table in `SPEC.md`.

## Where the list comes from

`SPEC.md` §5 is the slice table, and it is the input to this phase rather than a
record of it. Take the topmost row that is not `landed`, mark it `building`, and
set it to `landed` when the gate passes. If there is no spec, discovery has not
finished.

Two of its columns are binding. **Tenant-owned** decides whether the slice owes a
row-level security policy, `withOrgScope`, and a case in
`e2e/tests/tenancy.spec.ts`. **Shown by** names what must exist before the row can
be called landed — a slice nobody can demonstrate is a slice nobody can tell is
finished.

Anything not in the table is scope. It goes in the spec with a reason beside it,
in §5 or §7, rather than being absorbed quietly: the cut list is the section
people reopen, and an item that reappears without a reason is one that will be
cut again next time at the same cost.

## A slice

A slice is a feature that works end to end: the schema, the handler, the screen,
and the tests. Not "the backend for X" — that is half a thing, and half a thing
cannot be demonstrated or cut.

Do not start the next slice until the previous passes:

```
pnpm check && pnpm lint && pnpm test
pnpm e2e        # when the slice touched a route or a handler
```

**The gate, not the compiler.** On this repository that has already caught a Node
subpath import `tsc` resolved through tsconfig paths and Node could not, and a
lint fix that satisfied oxlint while breaking Playwright at run time. A green
compiler is not evidence the thing runs.

## Starting a feature area

```
pnpm new:module <name>
```

writes `packages/modules/<name>` and registers it. Then, per `RULES.md`:

- one file per operation, built with `RpcGroup.toLayerHandler`
- an `*RpcLive.ts` that only merges them
- a `Module.ts` root layer, leaving `SqlClient` and friends in its requirements
- for anything tenant-owned: a row-level security policy in the style of
  `0002_rls.sql` **and** `withOrgScope` around the queries — both, never either

## When the slice does not look like this repository

`knowledge/rules/effect-reach-for.md`, before writing it rather than after.

The starter uses about twenty of Effect's hundred and twenty modules, and the
twenty are the ones a boilerplate needs: identity, SQL, RPC, streams, config,
layers. A product reaches further, and the failure is never that somebody chose
the wrong module — it is that they did not know one existed and wrote four
hundred lines instead.

That file is keyed on the **problem**: a `for` loop that touches the network, a
lookup repeated per row, a decision worth caching, a sequence that must survive
a restart, a script with arguments. It says when each is right and — more
usefully — when it is not, because half of what it lists is wrong for this
codebase today and says so.

## Read the source

`repos/effect` is the vendored Effect monorepo at exactly the version installed.
Read the real signature there before using an API you have not already read this
session. It outranks `RULES.md`, `knowledge/` and recall, in that order, and
Effect v4 is a release candidate whose APIs moved recently.

## When it will not fit

Cut in this order:

1. A second frontend, an admin panel, anything cross-tenant
2. Configurability — a hard-coded value beats a settings screen nobody asked for
3. Integrations beyond the first
4. The dashboard

Never cut: tenant isolation, the audit trail, and the tests that prove both. They
are what a security review asks about, and retrofitting them costs more than
building them did.
