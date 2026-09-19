---
description: Push a screen from apps/design into Figma, built from design-system components.
argument-hint: "[screen: dashboard | contacts | members | api-keys | billing | assistant | sign-in | marketing | brand] [figma file url]"
---

Push a screen into Figma: **$ARGUMENTS**

1. **Load `figma-use` and `figma-generate-design`.** The second is the one that
   knows how to assemble a page from a design system rather than drawing a
   picture of one; skipping it produces a flat mock nobody can edit.
2. Run `pnpm design` and open the screen with the persona that shows it best.
   `crowded` is usually the right one — the long names and full tables are what a
   designer actually needs to see, and `settled` flatters the layout.
3. Sync the variables first if they have changed: `/figma-tokens`. A screen
   assembled before its tokens exist gets hardcoded values, which is the failure
   this whole arrangement is meant to avoid.
4. Assemble the screen section by section, binding to the variables from the
   `Tokens` collection rather than pasting hex.

The source of truth is `apps/design/src/screens/`, which renders the same
components as the product. Push what it shows, not an idealised version: the
point of the design app is that the thing designers refine is the thing that
ships.

**All three surfaces are on that canvas.** The product screens, the marketing
sections and the brand kit all render from `@vantion/ui`, so there is one app to
open and one place a Figma change comes back to. `/marketing` and `/brand` have
no personas — a landing page has no empty state — and the brand kit is read
straight from `@vantion/tokens`, so what it shows is what ships.
