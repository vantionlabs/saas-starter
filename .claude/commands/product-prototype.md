---
description: Build the real screens against the real app shell, with no new tables.
argument-hint: "[the surface: dashboard, onboarding, settings…]"
---

Run the prototype phase for: **$ARGUMENTS**

Read `docs/workflow/02-prototype.md` and follow it.

**The constraint that keeps this phase short: no migrations.** Build the screens
against tables that already exist, seeding rows by hand where you must. A
prototype that needs a schema is a build.

Work in `apps/web`, against the shell that is already there — sidebar, org
switcher, command palette, breadcrumbs, empty states, light and dark. Reuse
`@vantion/ui`; those are generated shadcn primitives and not yours to redesign.

Use the `impeccable` skill for the design itself — it is vendored in
`.claude/skills/impeccable`, and the `PostToolUse` hook fires it on changes under
`apps/web/src`. Mobbin is useful for references and is deliberately not in
`.mcp.json` — see `docs/workflow/02-prototype.md` for why, and the phase works
without it.

Screenshot each surface into `docs/workflow/prototype/` so the next phase can see
what it is building toward, and update `docs/workflow/STATE.md`.
