# Evals

`evals/` is the assistant's test set, its checks, and a baseline the build
compares against. `pnpm evals` runs it; `pnpm test` runs it too, which is what
makes it a gate rather than a report.

## Two halves, and only one can be a required check

**What must hold whatever a model says** — the right tool is reached for, a
write stops and asks, a refusal comes back with the permission named, one
tenant's question never reaches another's rows. These run on every push against
the scripted stand-in, cost nothing, and are deterministic. That is the gate.

**Whether a model chooses well** — does it pick the right tool for an
ambiguous question, does the answer read properly, does it refuse to guess.
This needs a real model, costs money, and answers differently each time. Run it
with `OPENROUTER_API_KEY` set, against a baseline you record for that model.

Both use the same harness and the same file. Only the first can be a required
check, and pretending otherwise is how a suite ends up disabled.

## The test set

`evals/cases/assistant.yaml`, in the format
[`vantionlabs/eval-harness`](https://github.com/vantionlabs/eval-harness) reads,
so the same file can be handed to that harness for rubric grading without being
rewritten. Three columns are ours, for properties a text-only harness has no
way to express:

| Column                    | What it checks                                         |
| ------------------------- | ------------------------------------------------------ |
| `expects_approval`        | the turn stopped and asked before writing              |
| `writes_without_approval` | nothing was written while the decision was open        |
| `expects_refusal`         | the named permission came back as a refusal            |
| `as_role`                 | which caller asks; `reader` holds `contact:read` alone |

**Ids are never reused.** Runs are compared by id, so renaming a case silently
rewrites its history.

## The gate

```
pnpm evals                    run and report
pnpm evals --update-baseline  record what this run scored
```

Two rules, and the second is the one that matters:

- A category's pass rate may drift down by five points. Models are not
  deterministic, and a suite that fails on noise gets switched off.
- A **new** critical failure fails the build whatever the rates say. "Tenant
  isolation broke but the average held up" is not a build anybody should be
  allowed to merge.

A run is never compared against a baseline recorded from a different model. The
comparison would be meaningless, and a meaningless gate is worse than none — so
it refuses and says so.

`baseline.json` is committed and updating it is a deliberate act with a diff
somebody reviews. That is the whole reason it is a file here rather than a
number in a dashboard.

## What the order of approval and permission means

Approval is evaluated **before** the handler runs, so a tool marked
`needsApproval` stops to ask before it ever reaches the policy that would refuse
it. A caller who may not create a contact is therefore asked to approve a
creation that would then be refused.

That is why `ASSIST-003` tests a refusal on a _read_. It is worth knowing rather
than working around: putting a permission check inside `needsApproval` would put
authorisation in a second place, and this repository has one permission model on
purpose.

## Adding a case

Write it down when something goes wrong, not when you are feeling thorough. A
production trace, a support conversation, an incident: those make cases that
catch the next one. Give it an id, a category, the exact input, what a good
response does, and at least one check — a case with no check can never fail, and
the suite asserts that none exists.
