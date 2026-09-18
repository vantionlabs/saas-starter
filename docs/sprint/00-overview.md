# The 30-day sprint

Thirty working days from a sentence to a deployed multi-tenant SaaS.

It is not fast because anyone types quickly. It is fast because the parts every
B2B product needs and none of them differ on — identity, organizations, roles,
tenant isolation, an audit trail, API keys, a versioned public API — are already
built and already tested in this repository. A sprint spends its days on the part
that is specific to the client, and that part is usually smaller than it looks
before someone writes it down.

| Days  | Phase                        | Command             | Produces                                                            |
| ----- | ---------------------------- | ------------------- | ------------------------------------------------------------------- |
| 1–5   | [Discover](01-discover.md)   | `/sprint-discover`  | A written riskiest assumption; a feature list that fits twelve days |
| 6–12  | [Prototype](02-prototype.md) | `/sprint-prototype` | Real screens against the real shell, no new tables                  |
| 13–24 | [Build](03-build.md)         | `/sprint-build`     | Vertical slices, each one green before the next                     |
| 25–30 | [Ship](04-ship.md)           | `/sprint-ship`      | Deployed, with the isolation tests still passing                    |

## How to run it

The four slash commands drive the phases. Each reads its file here, does the
work, and writes where it got to in `STATE.md` — which `SessionStart` reads back
at the start of the next session. A thirty-day sprint outlives any context
window, and that file is the only reason it survives one closing.

Copy `STATE.md.example` to `STATE.md` on day one. It is gitignored, because it
describes one client's sprint rather than the starter.

## The gates

Each phase refuses to hand over until one thing is true. They are the whole
method; everything else is detail.

- **Discover** will not advance while the riskiest assumption is unwritten.
- **Prototype** may not add a migration. If a screen needs a schema, it is a
  build, and it belongs in the list rather than the week.
- **Build** will not start a slice until the previous one passes the full gate,
  browser tests included.
- **Ship** will not deploy while anything on its checklist is untrue.

## What this is honest about

Thirty days produces a real product for a narrow problem, deployed, with tenant
isolation you can show a security reviewer. It does not produce a platform. The
work that gets cut is listed in [03-build.md](03-build.md), in the order it
should go.

If discovery kills the idea in week one, that is the sprint working. It has
happened, and it is cheaper than the alternative.
