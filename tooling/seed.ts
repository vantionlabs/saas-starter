#!/usr/bin/env tsx
/**
 * Fills a local database with something worth clicking through.
 *
 * An empty application proves nothing: every list is its empty state, no screen
 * shows a layout under load, and the admin panel has no tenant to open. This
 * makes three organizations that mirror `apps/design`'s personas — a first day,
 * an ordinary one, and the crowded one — so the running product and the design
 * canvas show the same three situations.
 *
 *   docker compose up -d
 *   pnpm --filter @vantion/database migrate
 *   pnpm dev          # the API has to be up: users are created through it
 *   pnpm seed
 *
 * It is **re-runnable**. Every insert is `on conflict do nothing` against a
 * fixed id, and an address that already exists is not a failure — so running it
 * twice is a no-op rather than a duplicate, and running it after a migration is
 * how you get the new tables filled.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { Console, Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { SqlClient } from "effect/unstable/sql";
import { PEOPLE, STAFF, TENANTS } from "./seed/Data.js";
import { PASSWORD, signUp } from "./seed/People.js";
import { seedTenant } from "./seed/Tenants.js";

const command = Command.make(
  "seed",
  {
    api: Flag.string("api").pipe(
      Flag.withDescription("Where the API is listening."),
      Flag.withDefault("http://localhost:3000"),
    ),
    web: Flag.string("web").pipe(
      Flag.withDescription("The origin better-auth trusts; sign-up is refused without it."),
      Flag.withDefault("http://localhost:5173"),
    ),
  },
  Effect.fnUntraced(function*({ api, web }) {
    yield* Console.log("Creating people…");

    for (const person of PEOPLE) {
      yield* signUp(api, web, person);
      yield* Console.log(`  ${person.email}`);
    }

    yield* Console.log("\nFilling organizations…");

    for (const tenant of TENANTS) {
      const outcome = yield* seedTenant(tenant);

      yield* Console.log(
        "seeded" in outcome
          ? `  ${outcome.seeded}`
          : `  skipped ${tenant.slug} — ${outcome.skipped} was not created`,
      );
    }

    /**
     * Staff is granted here and nowhere in the product, which is the point:
     * `0014_staff.sql` says there is deliberately no flow that can hand this
     * out, because a flow that could would be one that could hand it to
     * anybody. A local seed is the other end of that — the statement it tells
     * you to run, run for you.
     */
    const sql = yield* SqlClient.SqlClient;
    yield* sql`update "user" set "role" = 'admin' where "email" = ${STAFF}`;

    yield* Console.log(`\nEverybody's password is: ${PASSWORD}`);
    yield* Console.log(`Staff (for apps/admin): ${STAFF}`);
    yield* Console.log("\nSign in at http://localhost:5173");
  }),
);

NodeRuntime.runMain(
  Command.run(command, { version: "0.0.0" }).pipe(
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, PgLive.pipe(Layer.provideMerge(PgPool.layer))),
    ),
  ),
);
