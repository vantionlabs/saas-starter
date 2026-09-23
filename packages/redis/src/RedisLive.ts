import { Config, Deferred, Effect, Exit, Layer, Option, Redacted } from "effect";
import { Redis } from "effect/unstable/persistence";
import IORedis from "ioredis";

/**
 * Redis as an Effect service, built on the client this repository already has.
 *
 * `Redis.make` wants one function — `send(command, ...args)` — and builds the
 * script caching and `EVALSHA` handling on top of it. That is what makes this
 * small: `@effect/platform-bun` ships a `BunRedis` layer over Bun's own client,
 * and taking it would mean two Redis client libraries in one process, because
 * BullMQ needs **ioredis** and is not negotiable about it. One client, one
 * connection pool, one thing to configure — and the same client in the worker,
 * which is where the queue actually runs.
 *
 * It lives beside `packages/database` rather than in `packages/modules/*` for
 * the reason `RULES.md` gives: a vendor needed by more than one module becomes
 * its own thing. Redis is now wanted by jobs, by rate limiting, and by whatever
 * caches next — none of which owns it.
 */
export const layerRedis = (url: string): Layer.Layer<Redis.Redis> =>
  Layer.effect(Redis.Redis)(
    Effect.gen(function*() {
      const client = yield* Effect.acquireRelease(
        Effect.sync(() =>
          new IORedis(url, {
            // A command issued before the socket is up should wait for it
            // rather than fail; the alternative is a cold start that refuses
            // the first few requests for no reason a caller can act on.
            enableOfflineQueue: true,
            maxRetriesPerRequest: null,
          })
        ),
        (client) => Effect.promise(() => client.quit()).pipe(Effect.ignore),
      );

      return yield* Redis.make({
        send: <A = unknown>(command: string, ...args: ReadonlyArray<string>) =>
          Effect.tryPromise({
            try: () => client.call(command, ...args) as Promise<A>,
            catch: (cause) => new Redis.RedisError({ cause }),
          }),
        /**
         * A connection of its own per subscription, because a Redis
         * connection that has issued `SUBSCRIBE` can do nothing else. ioredis
         * reconnects and re-subscribes by itself, so what ends a subscription
         * is the scope closing, or the connection giving up — which is the
         * effect handed back, and what fails the caller's queue.
         */
        subscribe: (channel, onMessage) =>
          Effect.gen(function*() {
            const ended = yield* Deferred.make<void, Redis.RedisError>();
            const subscriber = yield* Effect.acquireRelease(
              Effect.tryPromise({
                try: async () => {
                  const subscriber = client.duplicate();
                  subscriber.on("message", (from: string, message: string) => {
                    onMessage({ channel: from, message });
                  });
                  subscriber.on("end", () => {
                    Deferred.doneUnsafe(
                      ended,
                      Exit.fail(new Redis.RedisError({ cause: "subscriber connection ended" })),
                    );
                  });
                  await subscriber.subscribe(channel);

                  return subscriber;
                },
                catch: (cause) => new Redis.RedisError({ cause }),
              }),
              (subscriber) => Effect.promise(() => subscriber.quit()).pipe(Effect.ignore),
            );

            return Deferred.await(ended).pipe(
              Effect.ensuring(Effect.sync(() => subscriber.removeAllListeners())),
            );
          }),
      });
    }),
  ).pipe(Layer.orDie);

/**
 * The URL, or nothing.
 *
 * Exported so each consumer makes the same decision from the same place rather
 * than each reading the variable and disagreeing about what an empty string
 * means.
 */
export const redisUrl: Effect.Effect<Option.Option<string>> = Config.option(
  Config.Redacted("REDIS_URL"),
).pipe(
  Effect.map(Option.flatMap((url) => {
    const value = Redacted.value(url).trim();

    return value === "" ? Option.none() : Option.some(value);
  })),
  Effect.orDie,
);
