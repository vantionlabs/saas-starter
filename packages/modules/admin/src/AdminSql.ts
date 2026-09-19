import { PgClient } from "@effect/sql-pg";
import { pgClientConfig } from "@vantion/database/PgLive";
import { Config, Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { SqlClient } from "effect/unstable/sql";

/**
 * The cross-tenant connection, and the whole of the boundary.
 *
 * `ADMIN_DATABASE_URL` names the `admin` role, which is the only one in this
 * schema provisioned with BYPASSRLS. Everything else — `apps/server`,
 * `apps/worker`, `apps/web` — connects as `vantion`, which cannot bypass a
 * policy whatever the code asks for.
 *
 * So a handler in the customer-facing API that forgets `withOrgScope` reads
 * nothing rather than reading everybody, and Postgres decides that rather than
 * a reviewer noticing. There is no flag, no service and no lint rule by which
 * one process becomes the other: they hold different credentials.
 *
 * A **separate tag** from `SqlClient`, not a second implementation of it. The
 * difference is the point — a handler asks for `SqlClient` and gets the scoped
 * connection, and the only way to reach the other one is to name it, which a
 * customer-facing module has no reason to do and no way to get.
 *
 * And a separate pool: sharing `PgPool` would mean one process holding both
 * credentials, and then the only thing between a bug and every tenant's data
 * would be which service a handler happened to ask for.
 */
export class AdminSql extends Context.Service<AdminSql, SqlClient.SqlClient>()("AdminSql") {}

/**
 * Refuses rather than falling back.
 *
 * Every other external boundary here has a credential-free layer — the mailer
 * logs, the queue runs in memory, storage writes to a directory — because a
 * fresh clone should work. This one deliberately has none. The quiet fallback
 * would be the application's own connection, which is exactly the thing that
 * must never read across tenants, and a deployment that silently downgraded to
 * it would look identical to one that worked. No `ADMIN_DATABASE_URL` means no
 * admin surface, which is the right default for a template.
 *
 * Left to infer rather than annotated `Layer.Layer<AdminSql>`: writing that
 * annotation makes the compiler infer `unknown` for the requirements and then
 * reject its own inference. Without it the type is `Layer<AdminSql, never,
 * never>`, which is what the annotation was trying to say.
 */
export const layerAdminSql = Layer.effect(AdminSql)(
  Effect.gen(function*() {
    const url = yield* Config.redacted("ADMIN_DATABASE_URL");

    return yield* PgClient.make({ url, ...pgClientConfig });
  }),
).pipe(Layer.provide(Reactivity.layer), Layer.orDie);
