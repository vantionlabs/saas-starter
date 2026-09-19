# Discover

The output is two documents and one decision. Not a research report.

## 1. Who this is for

Specific enough that you could show it to someone and they could say "no, that is
not us". Not a persona with a stock photo — a description of a job, a company
size, and the thing they do today instead of using this.

**What they do instead is the important half.** Every product competes with a
spreadsheet, an inbox rule, or an intern. If you cannot name the incumbent, you
do not yet know what you are replacing.

## 2. The riskiest assumption

One sentence. The thing that, if false, makes the rest pointless.

It is almost never "can we build it". It is usually one of:

- they will change a workflow they already have
- the data they would need to give us exists, and they are allowed to give it
- the person who feels the pain is the person who can buy
- it is worth more than the effort of adopting it

Write it down. **The discovery phase does not end until it is written**, because
a team that skips this builds the wrong thing exactly on schedule.

## 3. Check it against reality

Competitors' pricing pages, what people complain about in public, what they
already pay for. Search and fetch rather than recall, and cite what you find —
a decision made from a half-remembered statistic is a decision made from
nothing.

Look for the incumbent's price. It is the ceiling.

## 4. Cut the list

Write the feature list, then cut it to what the build phase can actually hold,
given that auth, organizations, roles, tenant isolation, the audit trail, API
keys and the public API are already done.

Most lists lose half their items here, and the half that goes is usually
configurability: a hard-coded value ships in an hour and a settings screen takes
two days, and nobody asked for the settings screen.

## How much fits

Cut against measurement rather than optimism. Seven feature modules were built in
this repository and every one is in the history, so these are what such slices
actually cost here — not what they ought to have cost.

| Slice                                            | Module | Tests | Tables | Routes |
| ------------------------------------------------ | -----: | ----: | -----: | -----: |
| A tenant-owned feature with a screen (`contact`) |    274 |   113 |      1 |      1 |
| A queue on a transactional outbox (`jobs`)       |    319 |   153 |      1 |      — |
| Outbound webhooks, signed and retried            |    323 |   272 |      2 |      — |
| A model's toolkit over existing stores (`agent`) |    251 |   186 |      0 |      — |
| Billing: Stripe, entitlements, a plan gate       |    786 |   487 |      2 |      1 |
| Uploads: presigned, expiring, under a limit      |    843 |   313 |      1 |      1 |
| An assistant over that toolkit, with approval    |    898 |   218 |      2 |      1 |

Lines of TypeScript, and they are not the units anybody bills in — but the
_ratios_ are the useful part and they hold. Read it this way:

- **The ordinary tenant-owned feature is the small number.** `contact` is one
  table, four operations, a screen and its tests. Most rows in a feature list are
  some version of this, and it is the unit to count the others in multiples of.
- **Tests are between a third and a whole module again.** A plan that counts only
  the source has already lost.
- **What costs is somebody else's protocol, not your domain.** Billing and the
  assistant are three times `contact`, and almost none of that is the feature —
  it is Stripe's redelivery, ordering and metadata, or a provider's encoded
  prompt. Any row whose description contains another company's name should be
  read as three rows.
- **A slice with no table is not a cheap slice.** `agent` adds no schema at all
  and still costs more than `contact`.

The starter's own foundations are the reason these numbers are small. Nothing in
the table pays for identity, organizations, roles, row-level security, the audit
trail, API keys or the public API, because each of those was already built and
already tested before the first of these modules existed.

## Output

- `docs/workflow/SPEC.md` — copied from `SPEC.md.example` and filled in: who, the
  incumbent, the assumption and its evidence, the slices in dependency order,
  what was cut and why
- One issue per assumption still unproven, labelled `assumption`
- `STATE.md` updated

The spec is the phase's real output. It is what `/product-build` reads instead of
re-deriving scope from a conversation nobody can open again, and it is committed —
`STATE.md` says where the work got to, the spec says what the work is.
