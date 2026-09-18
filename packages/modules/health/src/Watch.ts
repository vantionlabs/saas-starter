import { Effect, Schedule, Stream } from "effect";
import { SqlClient, SqlError } from "effect/unstable/sql";
import { DatabaseUnreachable, HealthReport } from "./Health.js";
import { HealthRpcs } from "./HealthRpc.js";

/**
 * Readiness, repeated until the client goes away.
 *
 * `Stream` rather than a loop pushing into a queue, because the repository says
 * so and because it is what makes cancellation free: when the connection drops
 * the fiber is interrupted, the schedule stops, and nothing keeps querying on
 * behalf of somebody who has left.
 *
 * The first report is immediate. A watcher that waits for the interval before
 * saying anything looks broken for as long as the interval is.
 */
export const Watch = HealthRpcs.toLayerHandler(
  "Watch",
  (payload) =>
    Stream.fromEffectSchedule(
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;

        yield* sql`SELECT 1`.pipe(
          Effect.catchTag(
            "SqlError",
            (error: SqlError.SqlError) =>
              new DatabaseUnreachable({
                reason: error.message.includes("timeout") ? "Timeout" : "ConnectionRefused",
              }),
          ),
        );

        return new HealthReport({ status: "Ok", database: true });
      }),
      Schedule.spaced(`${payload.every} seconds`),
    ),
);
