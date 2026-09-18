import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CurrentUser } from "../identity/Identity.js";
import { withOrgScope } from "../identity/OrgScope.js";
import { permission, withPolicy } from "../identity/Policy.js";
import { OrganizationRpcs } from "../organization/OrganizationRpc.js";
import { ApiKey, CreatedApiKey, hint, KEY_PREFIX } from "./ApiKey.js";

/**
 * Generated here, never accepted from the client, so a key is always 32 bytes of
 * CSPRNG output. Only the hash is stored; the plaintext exists in this response
 * and nowhere else, ever again.
 */
export const CreateApiKey = OrganizationRpcs.toLayerHandler(
  "CreateApiKey",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;

    const secret = `${KEY_PREFIX}${randomBytes(32).toString("hex")}`;
    const id = randomUUID();

    yield* withOrgScope(sql`
      insert into "apiKey" ("id", "organizationId", "name", "hash", "hint", "role")
      values (
        ${id}, ${identity.orgId}, ${payload.name},
        ${createHash("sha256").update(secret).digest("hex")},
        ${hint(secret)}, ${payload.role}
      )
    `).pipe(Effect.orDie, withPolicy(permission("organization:update")));

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
  }),
);
