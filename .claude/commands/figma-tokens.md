---
description: Sync the design system's variables into Figma from packages/tokens.
argument-hint: "[figma file url]"
---

Sync `@vantion/tokens` into the Figma file at: **$ARGUMENTS**

1. **Load the `figma-use` skill first.** The Figma MCP server requires it before
   every `use_figma` call, and it is the authority on API spelling — where it and
   the generated script disagree, the skill is right and the script is stale.
2. Generate the script: `pnpm --filter @vantion/tokens figma:script`. It is
   produced from `packages/tokens/src/tokens.ts`, so the values cannot drift from
   the ones the web app and the Expo app use, and it upserts rather than
   appends — a design system is synced repeatedly, not created once.
3. Execute it with `use_figma`, passing the file key from the URL.
4. Report what changed: variables created, variables updated.

**Do not hand-edit the generated script.** Change `tokens.ts` and regenerate;
that file is the single source the stylesheet, NativeWind and Figma all read.

Two things to know before running it:

- **Writing needs a Full seat.** A View seat will fail, and the failure does not
  always say so plainly — `whoami` lists the plans and their seats.
- **There is one mode.** This palette is dark and has no light variant. If a
  light one is wanted, it belongs in `tokens.ts` first, with its own tests, not
  invented in Figma where nothing checks it.
