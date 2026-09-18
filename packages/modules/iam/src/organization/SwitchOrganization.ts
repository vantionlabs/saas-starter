import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { CurrentUser } from "../identity/Identity.js";
import { NotAMember, OrganizationRpcs } from "./OrganizationRpc.js";

export const SwitchOrganization = OrganizationRpcs.toLayerHandler(
  "SwitchOrganization",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;

    // Membership is checked before the switch, so naming someone else's
    // organization fails rather than silently pointing the session at it.
    const rows = yield* sql<{ id: string; }>`
      select "id" from "member"
      where "userId" = ${identity.userId} and "organizationId" = ${payload.orgId}
    `.pipe(Effect.orDie);

    if (rows.length === 0) return yield* new NotAMember({ orgId: payload.orgId });

    yield* sql`update "session" set "activeOrganizationId" = ${payload.orgId}
               where "userId" = ${identity.userId}`.pipe(Effect.orDie);
  }),
);
