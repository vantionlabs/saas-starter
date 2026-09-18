---
description: Draw a user journey or flow into FigJam.
argument-hint: "[the flow: sign-up, invite a teammate, revoke a key…]"
---

Draw this journey into FigJam: **$ARGUMENTS**

1. **Load `figma-generate-diagram` first** — it is a mandatory prerequisite for
   `generate_diagram`, and it decides which diagram type fits or whether one
   should be drawn at all.
2. Derive the steps from the code rather than from memory. The routes under
   `apps/web/src/routes/` are what a person can actually reach, and the RPC
   groups in `packages/domain/src/AppRpcs.ts` are what they can actually do. A
   journey with a step the product does not have is worse than no journey.
3. Mark the decision points and the failure branches. The interesting part of
   "invite a teammate" is the seat limit and the already-a-member case, not the
   happy path.
4. Name the persona it is drawn for, from `apps/design/src/fixtures/personas.ts`.

Keep it to one flow per board. A diagram of the whole product is a picture of a
product, which is not a thing anyone uses.
