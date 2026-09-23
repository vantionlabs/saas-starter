import { Config, Context, Effect, Layer, Redacted } from "effect";
import * as Pg from "pg";

/**
 * The `pg` pool for the process, and the one place its database is named.
 *
 * better-auth, `PermissionResolver` and `StaffResolver` query through it
 * directly. The Effect `SqlClient` does not: `@effect/sql-pg` has its own
 * driver since rc.113, so `PgLive` opens its own connections to the address
 * configured here. A process therefore holds two pools, each of up to ten
 * connections, which is worth knowing when sizing a database's
 * `max_connections` against the number of replicas.
 */
export class PgPool extends Context.Service<PgPool, Pg.Pool>()("PgPool") {
  static layer: Layer.Layer<PgPool> = Layer.effect(PgPool)(
    Effect.gen(function*() {
      const url = yield* Config.Redacted("DATABASE_URL");
      const ssl = yield* Config.Boolean("DATABASE_SSL").pipe(Config.withDefault(false));

      const pool = new Pg.Pool({
        connectionString: Redacted.value(url),
        ssl,
        application_name: "vantion",
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 10_000,
      });

      // `pg` emits on idle-client failures; without a listener Node treats it as
      // an unhandled error event and tears the process down.
      pool.on("error", () => {});

      // A database we cannot reach at boot is not actionable by any caller, so
      // this is a defect rather than a typed failure.
      yield* Effect.acquireRelease(
        Effect.promise(() => pool.query("SELECT 1")),
        () => Effect.promise(() => pool.end()).pipe(Effect.ignore),
      );

      return pool;
    }),
  ).pipe(Layer.orDie);
}
