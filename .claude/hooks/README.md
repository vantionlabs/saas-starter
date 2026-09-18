# Hooks

These run automatically while an agent works in this repository. They are
ordinary Node scripts with no network access and no `npx`: read them before you
trust them, because that is the point of shipping them in the tree rather than
asking you to install something.

**To turn all of it off, delete `.claude/settings.json`.** Nothing else in the
repository depends on these.

| Event                          | Script                 | What it does                                                                                                                                                                            |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`                 | `session-context.mjs`  | Prints the pinned Effect version, whether `repos/` is vendored, and whether Postgres is up. Three facts that otherwise cost a session several turns.                                    |
| `PreToolUse` on `Bash`         | `guard-bash.mjs`       | Refuses force pushes, `--no-verify`, hand-edits to `repos/`, and an `rm -rf` naming a root or home directory.                                                                           |
| `PostToolUse` on `Edit\|Write` | `check-rules.mjs`      | Checks the part of `RULES.md` a regex can decide, on the file just written.                                                                                                             |
| `PostToolUse` on `Edit\|Write` | `format-and-check.mjs` | `dprint fmt`, `oxlint`, and `tsc -b` on the one package the file belongs to.                                                                                                            |
| `PostToolUse`, `Stop`          | impeccable             | The design pass. The skill is vendored at `.claude/skills/impeccable`; the call is still guarded on its launcher, so deleting the directory turns it off rather than breaking the hook. |

## How they report

A `PostToolUse` hook's stdout goes to the debug log and Claude never sees it, so
these exit 2 and write to stderr when they have something to say. The tool has
already run by then; exit 2 is what puts the finding in front of the model while
it can still act on it. `SessionStart` is one of the few events whose stdout is
added as context, so `session-context.mjs` prints instead.

## Why `check-rules.mjs` is shorter than `RULES.md`

Every rule it enforces holds across the whole repository today, and that is the
bar for adding one: a check that fires on existing code is a check somebody
disables in its first hour, along with the four that were working.

Two rules are deliberately absent because the code does not currently satisfy
them:

- **`Effect.orDie`.** `RULES.md` says never to use it; it appears 25 times,
  almost all as `sql\`…\`.pipe(Effect.orDie)`. Either the rule means something
  narrower than it says or the code owes a pass. Until that is settled, a check
  would fire on nearly every handler.
- **`new Error`.** Four uses, three of them test fixtures constructing a failure
  and one in `PgTest.ts`, which is test infrastructure. The rule says "app code",
  and drawing that line mechanically is not worth a false positive on every
  test file.

## Cost

`format-and-check.mjs` is the slow one, and it is scoped for that reason:
`tsc -b` on the owning package rather than the whole reference graph, which is
about a second on a warm build. `pnpm check` still runs the lot at commit time.
