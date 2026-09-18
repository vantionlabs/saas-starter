import { Effect } from "effect";
import { SqlClient, SqlError } from "effect/unstable/sql";
import { DatabaseUnreachable, HealthReport } from "./Health.js";
import { HealthRpcs } from "./HealthRpc.js";

/**
 * Readiness. The only failure a caller can act on is the database being
 * unreachable — every other `SqlError` reason is a defect.
 */
export const Check = HealthRpcs.toLayerHandler(
  "Check",
  Effect.fnUntraced(function*() {
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
);
