---
name: vantion-sprint
description: The 30-day MVP sprint this repository is built for — four phases, what each produces, and the gates between them. Use when planning or running a sprint, when asked how long something will take, when deciding what to cut, or when a phase's slash command needs the method behind it.
license: MIT
---

# The 30-day sprint

Thirty working days from a sentence to a deployed multi-tenant SaaS with auth,
organizations, roles, a public API and whatever the product actually is.

It works because most of it is already built. This repository ships the things
every B2B product needs and nobody demos — identity, tenancy, access control, an
audit trail, API keys, a versioned public API — so a sprint spends its days on
the part that is specific to the client.

## The four phases

| Days  | Phase     | Produces                                                               | Gate                                    |
| ----- | --------- | ---------------------------------------------------------------------- | --------------------------------------- |
| 1–5   | Discover  | A written riskiest assumption and a feature list that fits twelve days | The assumption is written down          |
| 6–12  | Prototype | Real screens against the real shell                                    | No migrations were needed               |
| 13–24 | Build     | Vertical slices, each green                                            | Every slice passes the full gate        |
| 25–30 | Ship      | Deployed, with the isolation tests still passing                       | Nothing on the ship checklist is untrue |

Each has a slash command — `/sprint-discover`, `/sprint-prototype`,
`/sprint-build`, `/sprint-ship` — and a file under `docs/sprint/` that the
command reads.

## What makes it survive contact

**The riskiest assumption is written before anything is built.** A sprint that
skips this builds the wrong thing on schedule, which is worse than building
nothing slowly.

**The prototype phase may not add a migration.** That single constraint is what
keeps day 12 reachable. If a screen needs a schema, it is a build, and it goes in
the list rather than the week.

**A slice is not done until the whole gate passes**, including the browser tests.
Not the compiler — the gate. On this repository that has already caught a Node
subpath import the compiler resolved and Node could not, and a lint fix that
satisfied the linter while breaking Playwright at run time.

**`docs/sprint/STATE.md` is the memory.** A thirty-day sprint outlives any
session's context. Each command writes where it got to; `SessionStart` reads it
back. Without that the loop restarts every time a context window does.

## What to cut first

In order, when the twelve build days will not fit:

1. A second frontend, an admin panel, anything cross-tenant
2. Configurability — one hard-coded value beats a settings screen nobody asked for
3. Integrations beyond the first
4. The dashboard. Almost nothing needs it in month one

What never gets cut: tenant isolation, the audit trail, and the tests that prove
both. Those are the things a client's own security review asks about, and
retrofitting them costs more than the sprint did.
