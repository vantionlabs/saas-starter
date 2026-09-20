import { layerPersistence } from "@/PersistenceLive.js";
import { layerRateLimitStore } from "@/RateLimitStore.js";
import { redisUrl } from "@/RedisLive.js";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option } from "effect";
import { Persistence, RateLimiter } from "effect/unstable/persistence";

const withEnv = (env: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromEnvRecord(env));

/**
 * `redisUrl` is the single decision every consumer here shares, which is why it
 * is exported rather than each of them reading the variable: the rate limiter,
 * the cache and the job queue must agree about what "no Redis" means, and three
 * copies of `Config.option` would be three chances to disagree.
 */
describe("redisUrl", () => {
  it.effect("is nothing when the variable is unset", () =>
    Effect.gen(function*() {
      expect(Option.isNone(yield* redisUrl)).toBe(true);
    }).pipe(Effect.provide(withEnv({}))));

  /**
   * The trap this exists to close. `REDIS_URL=` in a `.env` file is an ordinary
   * thing to write, and read naively it is a *present* value — so every layer
   * below would take the Redis branch and try to connect to the empty string.
   * Trimmed-empty means absent, and it has to mean that in one place.
   */
  it.effect("treats an empty value as absent, not as an address", () =>
    Effect.gen(function*() {
      expect(Option.isNone(yield* redisUrl)).toBe(true);
      expect(Option.isNone(yield* redisUrl.pipe(Effect.provide(withEnv({ REDIS_URL: "   " })))))
        .toBe(true);
    }).pipe(Effect.provide(withEnv({ REDIS_URL: "" }))));

  it.effect("hands back the address when there is one", () =>
    Effect.gen(function*() {
      expect(yield* redisUrl).toEqual(Option.some("redis://localhost:6379"));
    }).pipe(Effect.provide(withEnv({ REDIS_URL: "redis://localhost:6379" }))));

  /** Redacted in configuration, plain here: a client needs the string itself. */
  it.effect("keeps surrounding whitespace out of the address", () =>
    Effect.gen(function*() {
      expect(yield* redisUrl).toEqual(Option.some("redis://localhost:6379"));
    }).pipe(Effect.provide(withEnv({ REDIS_URL: "  redis://localhost:6379  " }))));
});

/**
 * Both layers build with **no Redis running**, which is the bargain this
 * repository makes everywhere: a fresh clone works, and a deployment that sets
 * the variable gets the shared thing. Building them is the assertion — the
 * Redis branch would open a socket, so reaching the service at all proves the
 * memory branch was taken.
 */
describe("without REDIS_URL", () => {
  it.effect("the rate limiter counts in memory", () =>
    Effect.gen(function*() {
      const store = yield* RateLimiter.RateLimiterStore;

      expect(store).toBeDefined();
    }).pipe(
      Effect.provide(layerRateLimitStore.pipe(Layer.provide(withEnv({})))),
      Effect.scoped,
    ));

  it.effect("the cache keeps what it looked up in memory", () =>
    Effect.gen(function*() {
      const persistence = yield* Persistence.Persistence;

      expect(persistence).toBeDefined();
    }).pipe(
      Effect.provide(layerPersistence.pipe(Layer.provide(withEnv({})))),
      Effect.scoped,
    ));
});
