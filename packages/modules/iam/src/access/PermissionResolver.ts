import { PgPool } from "@vantion/database/PgPool";
import { Context, Effect, Layer, Schema } from "effect";
import * as Pg from "pg";
import type { Override, Permission } from "../identity/Permission.js";
import { resolvePermissions } from "../identity/Permission.js";

/** Shape better-auth stores in `organizationRole.permission`. */
const CustomRoleGrants = Schema.Record(Schema.String, Schema.Array(Schema.String));

const flatten = (grants: Record<string, ReadonlyArray<string>>) =>
  Object.entries(grants).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}` as Permission)
  );

export interface PermissionResolverService {
  readonly resolve: (options: {
    readonly organizationId: string;
    readonly memberId: string;
    readonly role: string;
  }) => Effect.Effect<ReadonlyArray<Permission>>;
}

/**
 * Turns a membership into the caller's effective permissions.
 *
 * Reads the same two tables better-auth reads — `organizationRole` for custom
 * roles, plus our `memberPermission` for per-member overrides — so an
 * authorisation decision made here matches one better-auth makes on its own
 * endpoints.
 */
export class PermissionResolver
  extends Context.Service<PermissionResolver, PermissionResolverService>()("PermissionResolver")
{
  static layer: Layer.Layer<PermissionResolver, never, PgPool> = Layer.effect(PermissionResolver)(
    Effect.gen(function*() {
      const pool = yield* PgPool;

      const resolve = (options: {
        readonly organizationId: string;
        readonly memberId: string;
        readonly role: string;
      }) =>
        Effect.promise(async () => {
          /**
           * One connection, scoped, for both reads.
           *
           * `memberPermission` carries a row-level security policy keyed on
           * `app.current_org`, and this used to read it off the pool with no
           * scope and no organization in the predicate — so on a database where
           * the policy is actually in force it returned nothing, every
           * per-member override was silently ignored, and a **revoked**
           * permission stayed granted. It only ever worked because the
           * connection could bypass the policy, which `0002_rls.sql` says in
           * its own second paragraph must never be true.
           *
           * The organization is in the predicate as well, which is this
           * repository's rule rather than belt and braces: a role holding
           * BYPASSRLS ignores the policy even on a FORCEd table, and a managed
           * Postgres often hands you one.
           */
          const client = await pool.connect();

          try {
            await client.query("begin");
            await client.query(`select set_config('app.current_org', $1, true)`, [
              options.organizationId,
            ]);

            const [custom, overrides] = await Promise.all([
              client.query<{ permission: string; }>(
                `select "permission" from "organizationRole" where "organizationId" = $1 and "role" = $2`,
                [options.organizationId, options.role],
              ),
              client.query<{ permission: string; granted: boolean; }>(
                `select "permission", "granted" from "memberPermission"
                 where "memberId" = $1 and "organizationId" = $2`,
                [options.memberId, options.organizationId],
              ),
            ]);

            await client.query("commit");

            return { custom, overrides };
          } catch (error) {
            await client.query("rollback").catch(() => {});
            throw error;
          } finally {
            client.release();
          }
        }).pipe(
          Effect.map(({ custom, overrides }) => {
            // A custom role with unparseable permissions grants nothing rather
            // than throwing — better-auth logs and rejects, and failing open
            // here would be worse than a caller seeing too little.
            const customRoleGrants = custom.rows.flatMap((row) => {
              const parsed = Schema.decodeUnknownSync(CustomRoleGrants)(JSON.parse(row.permission));

              return flatten(parsed);
            });

            return resolvePermissions({
              role: options.role,
              customRoleGrants,
              overrides: overrides.rows as ReadonlyArray<Override>,
            });
          }),
          Effect.map((permissions) => Array.from(permissions)),
          // Authorisation must not fail open: if the lookup breaks, the caller
          // gets their role's permissions and nothing more.
          Effect.catchCause(() =>
            Effect.succeed(Array.from(resolvePermissions({
              role: options.role,
              customRoleGrants: [],
              overrides: [],
            })))
          ),
        );

      return { resolve };
    }),
  );
}

export type { Pg };
