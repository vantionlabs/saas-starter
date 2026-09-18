# Build

One vertical slice at a time.

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
