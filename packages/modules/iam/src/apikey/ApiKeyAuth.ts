import { withWorkerScope } from "@vantion/database/OrgScope";
import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { createHash } from "node:crypto";
import { PermissionResolver } from "../access/PermissionResolver.js";
import { Identity, OrgId, UserId } from "../identity/Identity.js";
import { looksLikeApiKey } from "./ApiKey.js";

/**
 * Turns an `Authorization: Bearer vantion_live_…` header into the same `Identity`
 * the session middleware produces.
 *
 * That sameness is the point. The public API reuses the RPC handlers, so it must
 * also reuse their `CurrentUser`, their policies and their org scoping — if API
 * traffic arrived with a different shape of caller, every `withPolicy` on every
 * handler would be a second code path nobody tested.
 *
 * A key has no user, so `userId` is the key's own id. Anything attributed to it
 * in the audit log therefore names the credential rather than a person, which is
 * the honest answer to "who did this".
 */

export class ApiKeyDenied {
  readonly _tag = "ApiKeyDenied";
  constructor(readonly reason: "missing" | "malformed" | "unknown") {}
}

export interface ApiKeyAuthService {
  /** Resolves the caller from a presented key, or explains why it could not. */
  readonly authenticate: (presented: string) => Effect.Effect<Identity, ApiKeyDenied>;
}

/**
 * Pulls the key out of an `Authorization` header value.
 *
 * Separate from `authenticate`, and taking the header rather than a request, so
 * that the service itself knows nothing about HTTP. The public API reads the
 * header off an `HttpServerRequest`; an MCP server reads it off whatever its
 * own transport provides. Neither needs a different `ApiKeyAuth`.
 */
export const bearerToken = (header: string | undefined): Effect.Effect<string, ApiKeyDenied> =>
  header === undefined
    ? Effect.fail(new ApiKeyDenied("missing"))
    : Effect.succeed(header.replace(/^Bearer\s+/i, ""));

export class ApiKeyAuth extends Context.Service<ApiKeyAuth, ApiKeyAuthService>()("ApiKeyAuth") {
  static layer: Layer.Layer<ApiKeyAuth, never, SqlClient.SqlClient | PermissionResolver> = Layer
    .effect(ApiKeyAuth)(
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient;
        const resolver = yield* PermissionResolver;

        const authenticate = Effect.fnUntraced(function*(presented: string) {
          // Shape-checked before hashing, so a malformed header costs no query.
          if (!looksLikeApiKey(presented)) {
            return yield* Effect.fail(new ApiKeyDenied("malformed"));
          }

          /**
           * Looked up by hash, across tenants, because which organization the
           * caller belongs to is precisely what is being determined — there is no
           * org to scope to yet. This is the one read that legitimately needs the
           * worker escape; the policies in migration 0010 still refuse any write
           * outside a scoped organization.
           */
          const hash = createHash("sha256").update(presented).digest("hex");

          const rows = yield* withWorkerScope(
            sql<{ id: string; organizationId: string; role: string; }>`
              select "id", "organizationId", "role" from "apiKey" where "hash" = ${hash}
            `,
          ).pipe(Effect.orDie);

          const key = rows[0];
          if (key === undefined) return yield* Effect.fail(new ApiKeyDenied("unknown"));

          // Best-effort: a failure to stamp last use must not fail the request.
          yield* withWorkerScope(
            sql`update "apiKey" set "lastUsedAt" = now() where "id" = ${key.id}`,
          ).pipe(Effect.ignore);

          const permissions = yield* resolver.resolve({
            organizationId: key.organizationId,
            // A key is not a member, so it has no per-member overrides — it gets
            // exactly what its role grants and nothing situational.
            memberId: "",
            role: key.role,
          });

          return new Identity({
            userId: UserId.make(key.id),
            orgId: OrgId.make(key.organizationId),
            email: `api-key:${key.id}`,
            emailVerified: true,
            role: key.role,
            permissions,
          });
        });

        // `resolver` and `sql` are captured, so nothing is left in the service's
        // requirements and any transport can call it.
        return {
          authenticate: (presented: string) =>
            authenticate(presented).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        };
      }),
    );
}

export const denialMessage = (denied: ApiKeyDenied): string => {
  switch (denied.reason) {
    case "missing":
      return "Provide an API key as `Authorization: Bearer <key>`.";
    case "malformed":
      return "That does not look like an API key.";
    // Deliberately identical to `malformed` in meaning: telling a caller that a
    // well-formed key is simply unknown confirms the format to somebody probing.
    case "unknown":
      return "That API key is not valid.";
  }
};
