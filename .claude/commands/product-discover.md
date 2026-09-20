---
description: Turn an idea into a written riskiest assumption and a feature list small enough to build.
argument-hint: "[the problem, in a sentence]"
---

Run the discovery phase for: **$ARGUMENTS**

Read `docs/workflow/01-discover.md` and follow it.

**Start by invoking the `grilling` skill on what the user just told you**, unless
they have already been grilled in this session or explicitly decline. Do not
write any of the documents below until they confirm the understanding is shared —
discovery's failure mode is misalignment, and a spec written from the first
plausible reading of a sentence is how a team builds the wrong thing exactly on
schedule.

Then, in short:

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
   than they think. The "How much fits" table in that file is measured from this
   repository's own modules — cut against it rather than against optimism.
5. **Write the spec.** Copy `docs/workflow/SPEC.md.example` to
   `docs/workflow/SPEC.md` and fill in every section. The feature list becomes
   §5, the slice table, in dependency order and with the tenant-owned column
   answered for each row — that column is what commits a slice to a row-level
   security policy and a tenancy test, so an unanswered one is a decision nobody
   took.

Then update `docs/workflow/STATE.md`.

The spec is the phase's real output, and it is committed. `/product-build` reads
it instead of re-deriving scope from a conversation nobody can open again, so a
section left as a placeholder is scope the build phase will improvise.

**Refuse to advance while the riskiest assumption is unwritten.** Skipping it
builds the wrong thing on schedule.
