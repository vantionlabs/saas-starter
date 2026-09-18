---
description: Turn an idea into a written riskiest assumption and a feature list small enough to build.
argument-hint: "[the problem, in a sentence]"
---

Run the discovery phase for: **$ARGUMENTS**

Read `docs/workflow/01-discover.md` and follow it. In short:

1. **Write down who this is for and what they do instead today.** Not a persona —
   a description specific enough that someone could be shown it and say "no, that
   is not us".
2. **Name the riskiest assumption.** The one that, if false, makes the rest
   pointless. Everything else is detail.
3. **Check it against reality** — competitors' pricing pages, what people
   complain about, what they already pay for. Use search and fetch. Cite what you
   find; do not summarise from memory.
4. **Cut the feature list to what the build phase can hold**, given that this
   repository already ships auth, organizations, roles, row-level security, an
   audit trail, API keys and a public API. Most products need far less new code
   than they think.

Write the result to `docs/workflow/01-discovery.md` and update
`docs/workflow/STATE.md`.

**Refuse to advance while the riskiest assumption is unwritten.** Skipping it
builds the wrong thing on schedule.
