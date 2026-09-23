import { PgClient } from "@effect/sql-pg";
import { Effect, Layer, Redacted, Schema, String } from "effect";
import type { SqlClient } from "effect/unstable/sql";
import { PgPool } from "./PgPool.js";

/** A pool built without a connection string gives this client nothing to connect to. */
class PgPoolUnaddressed extends Schema.TaggedError<PgPoolUnaddressed>()("PgPoolUnaddressed", {}) {}

/**
 * Client-level options shared by the live and test layers, so tests exercise the
 * same identifier casing as production. Pool-level settings live on `PgPool`.
 */
export const pgClientConfig = {
  transformQueryNames: String.camelToSnake,
  transformResultNames: String.snakeToCamel,
} as const;

/**
 * `SqlClient`, connected to the database `PgPool` was configured for.
 *
 * Since rc.113 `@effect/sql-pg` speaks the wire protocol itself rather than
 * wrapping `pg`, so it cannot borrow the `pg.Pool` better-auth runs on and
 * keeps connections of its own. It still takes its address from that pool,
 * which is what keeps "which database" one decision: the live pool reads
 * `DATABASE_URL`, the test pool reads `TEST_DB_URL`, and this client follows
 * whichever it is given.
 *
 * `multiplex` is off, and said so rather than left to a default. Tenant scope
 * is `set_config('app.current_org', …, true)` inside a transaction, and a
 * transaction reserves its connection whatever this flag says — but a client
 * that pipelined other fibers' statements onto shared connections is the
 * arrangement in which a scope set for one caller could be seen by another,
 * and that is not a trade worth a benchmark. Prepared statements stay on:
 * they are per connection and carry no session state.
 *
 * Connection failures surface as defects, so nothing actionable remains in
 * the error channel here.
 */
export const PgLive: Layer.Layer<PgClient.PgClient | SqlClient.SqlClient, never, PgPool> = PgClient
  .layerFrom(
    Effect.gen(function*() {
      const { options } = yield* PgPool;

      if (options.connectionString === undefined) {
        return yield* Effect.die(new PgPoolUnaddressed());
      }

      return yield* PgClient.make({
        url: Redacted.make(options.connectionString),
        ssl: options.ssl ?? false,
        ...(options.application_name === undefined
          ? {}
          : { applicationName: options.application_name }),
        multiplex: false,
        ...pgClientConfig,
      });
    }),
  ).pipe(Layer.orDie);
