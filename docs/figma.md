# Figma

The design system, the screens and the journeys all come from the code, and
designers' changes come back the same way.

## One canvas, three surfaces

`apps/design` is the middleman, and it is the only one. The product screens,
the marketing sections and the brand kit all render from `@vantion/ui` against
fixtures, so a designer opens one application and `/figma-screen` reads one
source.

That is why the presentational half of `apps/marketing` and `apps/brand` lives
in the design system rather than in those apps. What stays behind is routing,
metadata and **copy** — a designer changing a headline should not be editing a
route, and a component only one site can render is a component Figma cannot see.

The surfaces differ in what they need from the canvas. The product has personas,
because its screens have states you cannot reach without a backend — every list
empty, two dozen rows, a subscription that lapsed, a turn stopped mid-approval.
Marketing and brand have none: a landing page has no empty state, and the brand
kit is read straight from `@vantion/tokens`, so what it shows is already what
ships.

## What connects

Figma's own MCP server, not a third-party bridge. It ships the skills that do
the work, and each is a mandatory prerequisite for the tool it guards:

| Skill                    | For                                                         |
| ------------------------ | ----------------------------------------------------------- |
| `figma-use`              | any write at all — before every `use_figma` call            |
| `figma-generate-design`  | an application page assembled from design-system components |
| `figma-generate-library` | a design system built from a codebase                       |
| `figma-generate-diagram` | flows and journeys into FigJam                              |
| `figma-design-to-code`   | reading a design back out, before `get_design_context`      |
| `figma-code-connect`     | `.figma.ts` files mapping Figma components to code ones     |

Connect it however your client connects MCP servers; it is not in `.mcp.json`
because how it is installed differs between the desktop app, the remote server
and the editors, and a wrong entry is worse than none.

## The commands

| Command          | Does                                            |
| ---------------- | ----------------------------------------------- |
| `/figma-tokens`  | syncs `@vantion/tokens` into a file's variables |
| `/figma-screen`  | pushes a screen from `apps/design`              |
| `/figma-journey` | draws a flow into FigJam                        |
| `/figma-pull`    | brings a designer's change back into the code   |

## Why the tokens are generated rather than drawn

`pnpm --filter @vantion/tokens figma:script` prints a Plugin API script built
from `packages/tokens/src/tokens.ts`. Two properties matter:

**The values cannot drift.** The same file produces the stylesheet the web app
imports, the values NativeWind will read, and these variables. A palette
maintained separately in Figma is a palette that is wrong somewhere within a
month.

**It upserts.** A design system is synced repeatedly, not created once, so
running it twice updates the variables rather than adding a second set.

It is printed rather than executed by the build: writing to Figma needs a file
key and a seat that can edit, neither of which belongs in `pnpm build`.

## Colour, honestly

Figma variables hold sRGB channels; the tokens are `oklch`. The conversion is in
`packages/tokens/src/color.ts`, and a test asserts every token survives it
without clipping.

That test earned itself immediately: `success` was `oklch(0.65 0.2 150)`, which
is outside sRGB. Browsers clip such a colour silently, so what rendered was never
what was written — and the Figma variable, converted from the same string, would
have disagreed with both. It is `oklch(0.65 0.16 150)` now, the most saturated
green that hue and lightness can actually be.

## Seats

Writing needs a **Full** seat. A View seat fails, and not always legibly — run
`whoami` to see which plans the account has and what seat it holds on each.
