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

## What is not on Redis, and why

**Caching.** `PermissionResolver` and `EntitlementResolver` still read Postgres
per request. `PersistedCache` over `Persistence.layerBackingRedis` is exactly
the tool, and the reason it has not been done is not oversight: caching
authorisation trades a revocation delay for throughput, and this repository has
just spent two changes making sure a revoked permission is actually revoked. It
wants a deliberate TTL and a note in `docs/` about the window, not a default.

**Pub/sub.** Effect's `PubSub` is in-process. There is no Redis-backed
implementation in `effect/unstable/persistence`, so cross-process fan-out —
invalidating a cache on every replica, say — would be hand-written.
