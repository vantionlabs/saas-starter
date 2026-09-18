# The workflow

Four phases from a sentence to a deployed multi-tenant SaaS: discover,
prototype, build, ship.

It moves quickly, and not because anyone types quickly. The parts every B2B
product needs and none of them differ on — identity, organizations, roles,
tenant isolation, an audit trail, API keys, a versioned public API — are already
built and already tested in this repository, so the work goes on the part that is
specific to the product. That part is usually smaller than it looks before
somebody writes it down.

| Phase                        | Command              | Produces                                             |
| ---------------------------- | -------------------- | ---------------------------------------------------- |
| [Discover](01-discover.md)   | `/product-discover`  | A written riskiest assumption and a cut feature list |
| [Prototype](02-prototype.md) | `/product-prototype` | Real screens against the real shell, no new tables   |
| [Build](03-build.md)         | `/product-build`     | Vertical slices, each one green before the next      |
| [Ship](04-ship.md)           | `/product-ship`      | Deployed, with the isolation tests still passing     |

## How to run it

The four slash commands drive the phases. Each reads its file here, does the
work, and writes where it got to in `STATE.md` — which `SessionStart` reads back
at the start of the next session. A product outlives any context window, and that
file is the only reason the thread survives one closing.

Copy `STATE.md.example` to `STATE.md` when you start. It is gitignored, because
it describes one product rather than the starter.

## The gates

Each phase refuses to hand over until one thing is true. They are the whole
method; everything else is detail.

- **Discover** will not advance while the riskiest assumption is unwritten.
- **Prototype** may not add a migration. If a screen needs a schema, it is a
  build, and it belongs in the list rather than in this phase.
- **Build** will not start a slice until the previous one passes the full gate,
  browser tests included.
- **Ship** will not deploy while anything on its checklist is untrue.

## What this is honest about

The output is a real product for a narrow problem, deployed, with tenant
isolation you can show a security reviewer. It is not a platform. The work that
gets cut is listed in [03-build.md](03-build.md), in the order it should go.

If discovery kills the idea, that is the method working. It has happened, and it
is cheaper than the alternative.
