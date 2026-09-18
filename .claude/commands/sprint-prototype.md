---
description: Days 6-12. Build the real screens against the real app shell, with no new tables.
argument-hint: "[the surface: dashboard, onboarding, settings…]"
---

Run the prototype phase of the 30-day sprint for: **$ARGUMENTS**

Read `docs/sprint/02-prototype.md` and follow it.

**The constraint that makes day 12 reachable: no migrations in this phase.** Build
the screens against tables that already exist, seeding rows by hand where you
must. A prototype that needs a schema is a build, and builds do not fit in a
week.

Work in `apps/web`, against the shell that is already there — sidebar, org
switcher, command palette, breadcrumbs, empty states, light and dark. Reuse
`components/ui`; those are generated shadcn primitives and not yours to redesign.

Use the `impeccable` skill for the design itself if it is installed. It is the
phase's real dependency. Mobbin is useful for references and is deliberately not
in `.mcp.json` — see `docs/sprint/02-prototype.md` for why, and the phase works
without it.

Screenshot each surface into `docs/sprint/prototype/` so the next phase can see
what it is building toward, and update `docs/sprint/STATE.md`.
