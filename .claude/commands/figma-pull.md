---
description: Bring a designer's Figma change back into the code.
argument-hint: "[figma node url]"
---

Implement this Figma change in the code: **$ARGUMENTS**

1. **Load `figma-design-to-code` first.** It is a mandatory prerequisite for
   `get_design_context` and it is what stops the result being a pixel-matched
   component that shares nothing with the design system.
2. Read the node. Work out whether the change is a **token**, a **component**, or
   a **screen** — they land in three different places and getting it wrong is how
   a one-off colour ends up hardcoded in a route:
   - a colour, radius or type change → `packages/tokens/src/tokens.ts`, then
     `bun run --filter @vantion/tokens build:css`
   - a component's appearance → `packages/ui/src/`, whichever surface it belongs
     to: `marketing/`, `brand/`, `settings/`, `assistant/` and the rest are all
     the same design system
   - a layout or composition → `apps/design/src/screens/` and the matching route
     in `apps/web`, `apps/marketing` or `apps/brand`
3. If it is a token, check it is inside sRGB before committing — the test will
   fail otherwise, and it is right to: a colour outside the gamut is clipped by
   the browser without a word, so what renders is not what was designed.
4. Run the gate: `bun run check && bun run lint && bun run test`, and `bun run e2e` if a route
   changed.

A design change that cannot be expressed as one of those three is usually a
design change that has not been decided yet. Say so rather than inventing a
fourth place to put it.
