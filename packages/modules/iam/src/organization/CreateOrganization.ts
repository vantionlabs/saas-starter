import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import { CurrentUser, OrgId } from "../identity/Identity.js";
import { Membership, OrganizationRpcs } from "./OrganizationRpc.js";

const slugify = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${
    randomUUID().slice(0, 6)
  }`;

/** Anyone may create an organization — it is their own, and they own it. */
export const CreateOrganization = OrganizationRpcs.toLayerHandler(
  "CreateOrganization",
  Effect.fnUntraced(function*(payload) {
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* CurrentUser;
    const orgId = OrgId.make(randomUUID());
    const slug = slugify(payload.name);

    yield* sql.withTransaction(
      Effect.gen(function*() {
        /**
         * Created already onboarded, and that is not a shortcut.
         *
         * The wizard's first step asks for a name, which this caller has just
         * typed, and its second invites colleagues they can invite from
         * settings — so sending somebody who is already inside the product
         * through it would ask them to name the thing they just named. What
         * onboarding is for is the organization sign-up makes on your behalf,
         * which nobody chose anything about.
         */
        yield* sql`insert into "organization"
                   ("id", "name", "slug", "createdAt", "onboardingStep", "onboardingCompletedAt")
                   values (${orgId}, ${payload.name}, ${slug}, now(), 'done', now())`;
        yield* sql`insert into "member" ("id", "organizationId", "userId", "role", "createdAt")
                   values (${randomUUID()}, ${orgId}, ${identity.userId}, 'owner', now())`;
        // Land the caller in the organization they just made.
        yield* sql`update "session" set "activeOrganizationId" = ${orgId}
                   where "userId" = ${identity.userId}`;
      }),
    ).pipe(Effect.orDie);

    return new Membership({ orgId, name: payload.name, slug, role: "owner", isActive: true });
  }),
);
