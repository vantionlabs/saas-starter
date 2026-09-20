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

**Run `impeccable init` before the first screen.** It interviews you and writes
`PRODUCT.md` — who this is for, the brand, the principles — and every other
impeccable command reads that file before doing work. The repository does not
ship one, deliberately: it is your product's answers to questions only your team
can answer. Without it, design commands work brand-agnostically, which is a
slower way to arrive at something that does not sound like you.

The first invocation downloads the launcher's binary, so it needs network and is
not instant. Every one after it is.

**Then `impeccable document`, once there are screens.** It derives `DESIGN.md` —
colours, type, spacing, components — from what the code actually looks like, so
running it on a fresh clone would describe the starter's defaults rather than
your product. Once the prototype has a few screens, it is the file that keeps
every later change on-brand.

Use the `impeccable` skill for the design work itself. It is the phase's real
dependency, and the `PostToolUse` hook fires it on changes under `apps/web/src`
when it is installed. `docs/workflow/00-overview.md` has the full table of what
to run once and when.

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
