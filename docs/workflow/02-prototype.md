# Prototype

Real screens, in the real application, against the real shell. Not a mockup: a
person should be able to click through it.

## The constraint

**No migrations this phase.** Build against tables that already exist, seeding
rows by hand where you must.

This is the single rule that keeps the phase short. A screen that needs a schema
is a build, not a prototype, and the schema it needs will be wrong until the
screens have argued with each other. Note what it would need and move on.

## What is already there

`apps/web` ships an application, not a starting point: sidebar, organization
switcher, command palette, breadcrumbs, error boundaries, empty states, light and
dark. Build inside it.

`components/ui` is generated shadcn on Base UI. It is not yours to redesign —
changing it is how a project ends up maintaining a fork of a component library it
did not write.

## Design

Use the `impeccable` skill for the design work itself. It is the phase's real
dependency, and the `PostToolUse` hook fires it on changes under `apps/web/src`
when it is installed.

**Mobbin** is useful for references and is deliberately absent from `.mcp.json`.
The servers for it are third-party and unofficial, there are two competing ones,
and it needs a paid account — a config file carrying this company's name should
not require any of that. Use it from the Mobbin app if you have it. The phase
works without it.

## Output

- Routes under `apps/web/src/routes/`, reachable and clickable
- Screenshots in `docs/workflow/prototype/`, so the build phase can see the target
- A written note of every table the screens implied, for the build list
- `STATE.md` updated
