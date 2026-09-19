# Redis

Optional, and the product runs without it — but two things change when it is
absent, and one of them is a security property rather than a performance one.

## What uses it

|               | With `REDIS_URL`                                      | Without                               |
| ------------- | ----------------------------------------------------- | ------------------------------------- |
| Job queue     | BullMQ: scheduling, retries, concurrency, a dashboard | in-memory; nothing survives a restart |
| Rate limiting | one counter, shared by every process                  | one counter **per process**           |

The outbox is transactional either way — that lives in Postgres and is not
Redis's business. What Redis adds is delivery and shared counting.

## The rate limit is the one that matters

`AuthHttp.ts` says it plainly: throttling _is_ the security boundary on the OTP
path, because "a six-digit OTP carries about twenty bits, so it is only as
strong as the number of attempts allowed."

An in-memory store counts per process. Behind a load balancer that means the
limit is multiplied by the number of replicas — three instances give a caller
thirty attempts a minute where the code says ten, and ten instances give a
hundred. Nothing looks wrong: each process is enforcing its limit correctly.

This repository shipped with `layerStoreMemory` and a comment offering the Redis
store as an option for sharing limits "across workers". That undersold it. It is
the same failure the `X-Forwarded-For` fix addressed on the same endpoint — a
limit that appears enforced and is not — arrived at from a different direction.

**So: one instance without Redis is fine. More than one is not.**

## One client, not two

`@effect/platform-node` ships a `NodeRedis` layer over _node-redis_, and this
repository does not use it. BullMQ requires **ioredis** and is not negotiable
about that, so taking the platform layer would mean two Redis client libraries,
two connection pools and two things to configure in one process.

`Redis.make` wants a single function — `send(command, ...args)` — and builds
script caching and `EVALSHA` on top of it. `packages/redis/src/RedisLive.ts` is
that function over ioredis, and it is about twenty lines.

It sits beside `packages/database` rather than inside `packages/modules/*` for
the reason `RULES.md` gives: a vendor wanted by more than one module becomes its
own thing. Jobs want it, rate limiting wants it, and whatever caches next will
want it — none of them owns it.

## The public API is limited too

It was not, at all, until recently: a key could be called without bound, which
on a versioned surface with no session and no captcha is the easiest thing in
the product to abuse.

The allowance is a **plan limit** (`limits.apiRequestsPerMinute`), so an upgrade
raises it on the next request rather than the next deploy, and it is keyed on
the **organization** rather than the key — a key is a credential, and a quota
belongs to whoever is paying for it. Issuing a second key does not double what a
tenant may do, and a test asserts exactly that.

`429` is declared in `api/v1/Wire.ts` beside the other statuses, so it appears in
the OpenAPI document and a generated client knows to back off rather than
treating it as an unknown failure. Adding a status to a versioned API is a change
every client has to cope with, which is why it is in the contract rather than
returned ad hoc.

## Caching, and the window it opens

`EntitlementResolver` is cached. Every authenticated request asks what the
organization is paying for, so it is the hottest read in the product and the one
that changes least.

Caching authorisation is a security decision rather than a performance one, so
the numbers are stated rather than defaulted, in
`packages/modules/iam/src/identity/Cached.ts`:

|                                          |            |
| ---------------------------------------- | ---------- |
| Shared store (Redis)                     | 30 seconds |
| Each process's own cache, in front of it | 2 seconds  |

**Invalidation is explicit, which is why the store is shared.** Dropping an
entry removes it from Redis for every replica at once, so a plan change does not
wait for a clock anywhere. The Stripe webhook that writes a subscription drops
the entry, and the direction that matters — a _downgrade_ — therefore stops
entitling on the next request everywhere rather than lingering for a TTL. A test
asserts exactly that.

What a TTL still bounds is the small in-process cache in front of the store:
invalidating on one replica cannot reach into another's memory. Two seconds is
the real worst case for a change made elsewhere, and it is short on purpose.

A cache that cannot be reached falls through to the database rather than
refusing. Slower and correct beats neither.

`apps/mcp` uses `Persistence.layerMemory` instead: it is one editor's
subprocess, holds one identity for its lifetime, and is gone when the editor
closes. Nothing there benefits from a shared cache, and joining one would make
an MCP server a reason to run Redis.

## What is not cached, and why

**`PermissionResolver`.** What a _person_ may do changes when an administrator
edits a role or sets an override, and those are exactly the changes somebody
makes because they want them to take effect now. The entitlement case is
comfortable because Stripe's webhook already lags by seconds to minutes, so a
cache sits inside a delay the product has anyway; a revoked permission has no
such delay to hide in. It would need the same invalidation on four write
handlers, and until that is written the resolver reads Postgres every time —
which is correct, and the slower half of one query.

**Pub/sub.** Effect's `PubSub` is in-process. There is no Redis-backed
implementation in `effect/unstable/persistence`, so any fan-out that is not
invalidation-through-a-shared-store would be hand-written.
