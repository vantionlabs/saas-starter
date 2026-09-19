import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CurrentEntitlement, LimitReached } from "../identity/Entitlement.js";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { all, feature, permission, withPolicy } from "../identity/Policy.js";
import { apiKeysUsed } from "../identity/Usage.js";
import { OrganizationRpcs } from "../organization/OrganizationRpc.js";
import { ApiKey, CreatedApiKey, hint, KEY_PREFIX } from "./ApiKey.js";

/**
 * Generated here, never accepted from the client, so a key is always 32 bytes of
 * CSPRNG output. Only the hash is stored; the plaintext exists in this response
 * and nowhere else, ever again.
 */
const create = Effect.fnUntraced(
  function*(payload: { readonly name: string; readonly role: ApiKey["role"]; }) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;
    const entitlement = yield* CurrentEntitlement;

    /**
     * The limit was declared and never checked, which is the worse half of a
     * quota: a plan that says two keys and hands out a third teaches people the
     * number is decoration — and it makes the usage screen a lie rather than a
     * reason to upgrade. Counted before anything is generated, because the last
     * moment to refuse is before a credential exists.
     */
    const allowed = entitlement.limits.apiKeys;

    if ((yield* apiKeysUsed()) >= allowed) {
      return yield* new LimitReached({ limit: "apiKeys", allowed });
    }

    const secret = `${KEY_PREFIX}${randomBytes(32).toString("hex")}`;
    const id = randomUUID();

    yield* withOrgScope(sql`
    insert into "apiKey" ("id", "organizationId", "name", "hash", "hint", "role")
    values (
      ${id}, ${identity.orgId}, ${payload.name},
      ${createHash("sha256").update(secret).digest("hex")},
      ${hint(secret)}, ${payload.role}
    )
  `).pipe(Effect.orDie);

    return new CreatedApiKey({
      key: new ApiKey({
        id,
        name: payload.name,
        hint: hint(secret),
        role: payload.role,
        createdAt: yield* DateTime.now,
        lastUsedAt: null,
      }),
      secret,
    });
  },
);

/**
 * The policy wraps the **whole** handler, not just the insert it used to guard.
 *
 * Order matters once there is a limit: asked the other way round, somebody with
 * no right to create a key would be told the organization had run out of them,
 * which is a fact about the tenant told to a caller who may not act on it. Who
 * you are is settled before anything about the plan is.
 */
export const CreateApiKey = OrganizationRpcs.toLayerHandler(
  "CreateApiKey",
  (payload) =>
    create(payload).pipe(
      withPolicy(all(permission("organization:update"), feature("api_keys"))),
    ),
);
