# What to reach for

Effect ships about a hundred and twenty modules. This repository uses roughly
twenty, because a boilerplate has a boilerplate's problems: it authenticates,
stores rows, serves an API and sends mail. A product has other ones.

This file is keyed on **what you are about to do**, not on module names, because
the failure it exists to prevent is writing four hundred lines of something that
is one import. Read it when a task does not look like the code already here.

Everything below is at `4.0.0-rc.117`, and `repos/effect` is the authority —
open the real signature before using anything named here.

---

## Branching on a shape

**Reach for `Match`** when a function is a ladder of `if`s or nested ternaries
over a **discriminated union**, especially one you control. `Match.tag` picks on
`_tag`, and `Match.exhaustive` turns a forgotten case into a compile error,
which is the whole point — a new variant should break the build rather than
silently take the fallback branch.

**Do not** reach for it over a union you do not own and that grows: this
repository handles four of twelve-plus `Response.StreamPart` variants
deliberately, and exhaustiveness there would mean a decision about every part
type a provider adds. A plain `if` chain with a comment is better.

**Do not** reach for it over a non-discriminated shape — matching on message
contents and a status code reads worse than the ternary it replaces.

## Bounding concurrency

Three tools, and they answer different questions.

- **`{ concurrency: n }` on `Effect.forEach`** bounds *one* loop. Start here.
- **`Semaphore`** bounds work across loops that cannot see each other. This
  repository uses one in `packages/modules/webhooks/src/Outbound.ts`, because
  the worker dispatches several jobs at once and each fans out to several
  endpoints: two `concurrency` options multiply, and one permit pool does not.
- **`PartitionedSemaphore`** bounds *per key* — per tenant, per host, per
  customer — which is what you want when one noisy organization must not spend
  everybody's budget.

The smell that means you need one: a `for` loop with `yield*` inside it that
touches the network. Sequential is bounded and slow in the worst way, because
one slow counterparty stalls everything behind it.

## Counting things

**`Metric`**, exported through the OTLP endpoint that already carries traces.
A span says what one request did; a metric says how deep the queue is right now
and what share of deliveries failed. Neither of the other two can be turned into
the other.

`packages/telemetry/src/Metrics.ts` declares them in one place on purpose — a
name is a contract with whatever is graphing it.

## Not doing the same work twice

- **`Cache`** for an in-process memo with a TTL and a capacity.
- **`PersistedCache`** over **`Persistence`** when several processes should
  share it — backed by Redis, SQL, or memory. This is what
  `identity/Cached.ts` uses.

**Caching an authorisation decision is a security decision.** Write down the
window before writing the code: how stale may this be, what invalidates it, and
does invalidation reach every replica. A shared store answers the last one,
because dropping a key removes it for everybody — Effect ships no Redis-backed
pub/sub to announce it any other way.

## Rate limiting

**`RateLimiter`** from `effect/unstable/persistence`, with
`layerStoreRedis` in any deployment running more than one process. An in-memory
store counts per process, so N replicas give a caller N times the limit.

## The same query, once per row

**`Request` and `RequestResolver`.** If a handler loops over rows and looks
something up for each, that is an N+1 and the resolver batches it into one
round trip. Nothing here needs it yet; a product with a list view over joined
data will.

## Long, multi-step processes that must survive a restart

**`effect/unstable/workflow`.** A `Workflow` is a durable function; each step is
an `Activity` whose result the engine **stores**, so a crash resumes from the
last completed step rather than re-running it. It also gives `DurableClock`
(sleep for a week, survive a deploy), `DurableDeferred` (wait for a signal), and
compensation.

That is genuinely more than a job queue, which gives you a job that retries
rather than a process that resumes. Reach for it when a sequence spans systems
and partial completion is expensive: charge the card, provision the tenant, send
the welcome, and on failure at step three do not charge twice.

**Check before adopting.** There are two engines: `layerMemory`, which is not
durable, and `ClusterWorkflowEngine`, which needs the cluster runtime. The
cluster's storage is not the gap it looks like from `MessageStorage.ts` alone —
`SqlMessageStorage` and `SqlRunnerStorage` persist to Postgres through the same
`SqlClient` — so durable workflows mean adopting the cluster, not writing its
storage. That is still a runtime to operate, and the reason to reach for it has
to be bigger than one sequence.

## Atomic coordination inside one process

**`TxRef`, `TxHashMap`, `TxQueue` and the rest.** Software transactional
memory: reads and writes inside `Effect.tx` go to a journal and commit together.

The journal is **one process's heap**. Nothing survives a restart and nothing is
shared between the API and the worker, so it is not a substitute for a database
transaction. It is right for in-memory invariants that several fibers touch — a
shared budget, an in-process registry — and wrong for anything Postgres already
guarantees.

## Moving CPU work off the event loop

**`effect/unstable/workers`** — worker threads and Web Workers. Right for image
processing, PDF rendering, parsing something enormous. Wrong for IO: a worker
thread adds serialisation cost and removes nothing from an event loop that was
waiting on a socket.

## Many live stateful things, each with one home

**`effect/unstable/cluster`** — entities addressed by id, sharded across
runners, with a shard manager and message storage. The Akka/Orleans model:
a million live game sessions, each needing a single writer.

A worker draining a queue is not this. Scale that by running more copies —
`for update skip locked` on the outbox already makes it safe. The cluster also
carries `ClusterCron`, which is where distributed scheduled work lives.

## Doing something on a schedule

**`Schedule`** for retry and repeat policies — exponential, jittered, capped.
Already used by the worker loop and by webhook delivery. **`Cron`** parses
calendar expressions when "every Tuesday at 09:00" is the requirement rather
than "every thirty seconds".

## Consuming a stream

**`Sink`** when folding a `Stream` into a value — collecting, batching, writing
to a file — rather than hand-rolling a `Ref` and a `runForEach`.

## A script with arguments

**`effect/unstable/cli`**. `Command.make` with `Flag` and `Argument` gives
generated `--help`, shell completions, and typed parsing, and the handler is an
ordinary `Effect` — so failures are typed errors rather than `process.exit(1)`.
`scripts/vendor.ts` is the worked example. `NodeServices.layer` provides the
whole of its `Environment`.

## Values that compare by contents

**`Data`** for structural equality and hashing, **`Equal`** and **`Hash`** to
implement it yourself, **`Order`** for comparators that compose. Reach for these
when putting objects in a `HashSet`, deduplicating, or sorting by several keys —
not for ordinary records nothing compares.

## Handing work between fibers

**`Queue`**, **`PubSub`**, **`Mailbox`** — all in-process. `PubSub` is
fan-out **within one process**; there is no Redis-backed implementation, so
cross-replica fan-out is hand-written or avoided by invalidating a shared store
instead.

## Expensive things worth reusing

**`Pool`** for a bounded pool of anything costly to create. Not needed for
Postgres or Redis here — both clients pool internally — but right for a
headless browser, a compiler instance, a native handle.

---

## Before adding a dependency

Check `repos/effect/packages/effect/src/` first. The list above is not
exhaustive: there is a `Graph`, a `Trie`, a `HashRing`, `JsonPatch`,
`BigDecimal`, `Optic`, `Redactable`, `Cron`, `FileSystem`, `Path`. A package
that duplicates one of them is a package with a second set of bugs and no
integration with `Effect`'s error channel, spans or interruption.
