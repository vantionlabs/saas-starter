import { Effect, Layer, Option } from "effect";
import { RateLimiter } from "effect/unstable/persistence";
import { layerRedis, redisUrl } from "./RedisLive.js";

/**
 * Where the rate limiter counts, and why it must not be memory in production.
 *
 * `AuthHttp.ts` says throttling *is* the security boundary on the OTP path — "a
 * six-digit OTP carries about twenty bits, so it is only as strong as the
 * number of attempts allowed". An in-memory store makes that budget **per
 * process**: three API replicas behind a load balancer give a caller thirty
 * attempts a minute instead of ten, and ten replicas give a hundred. The limit
 * looks enforced and is not, which is the same shape as the `X-Forwarded-For`
 * bug this repository fixed for the same endpoint.
 *
 * So Redis when `REDIS_URL` is set, memory when it is not — the bargain the
 * mailer and the job queue already make. A fresh clone still works; a
 * deployment gets one shared counter. `docs/redis.md` is explicit that running
 * more than one instance *without* Redis multiplies the limit by the number of
 * instances.
 */
export const layerRateLimitStore: Layer.Layer<RateLimiter.RateLimiterStore> = Layer.unwrap(
  Effect.gen(function*() {
    const url = yield* redisUrl;

    if (Option.isNone(url)) return RateLimiter.layerStoreMemory;

    return RateLimiter.layerStoreRedis({ prefix: "vantion:ratelimit" }).pipe(
      Layer.provide(layerRedis(url.value)),
    );
  }),
);
