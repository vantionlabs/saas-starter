import { Effect, Layer, Option } from "effect";
import { Persistence } from "effect/unstable/persistence";
import { layerRedis, redisUrl } from "./RedisLive.js";

/**
 * Where a cache keeps what it has looked up.
 *
 * Redis when `REDIS_URL` is set, memory when it is not — the same bargain
 * everything else here makes, and the same consequence: without Redis each
 * process caches on its own, which for a cache is a performance difference
 * rather than a correctness one. The correctness part is invalidation, and that
 * is why the shared store matters.
 *
 * **A shared cache is what makes a revoke take effect everywhere.** Invalidating
 * an entry removes it from Redis for every replica at once, so there is no need
 * for the pub/sub Effect does not ship. What is left is each process's own
 * in-memory layer in front of it, which `PersistedCache` bounds with a short TTL
 * — see `packages/modules/iam/src/identity/Cached.ts` for the numbers and what
 * they mean.
 */
export const layerPersistence: Layer.Layer<Persistence.Persistence> = Layer.unwrap(
  Effect.gen(function*() {
    const url = yield* redisUrl;

    if (Option.isNone(url)) return Persistence.layerMemory;

    return Persistence.layerRedis.pipe(Layer.provide(layerRedis(url.value)));
  }),
);
