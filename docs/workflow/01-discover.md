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

## Output

- `docs/workflow/01-discovery.md` — who, the incumbent, the assumption, the evidence
- One issue per assumption still unproven, labelled `assumption`
- The cut feature list
- `STATE.md` updated
