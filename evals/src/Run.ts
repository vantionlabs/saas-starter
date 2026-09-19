import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPool } from "@vantion/database/PgPool";
import { AgentModule } from "@vantion/module-agent/Module";
import { AssistantRpcs } from "@vantion/module-assistant/AssistantRpc";
import { AssistantRpcLive } from "@vantion/module-assistant/AssistantRpcLive";
import type { ModelStatus } from "@vantion/module-assistant/Model";
import { layerModel } from "@vantion/module-assistant/Model";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { AuthMiddleware } from "@vantion/module-iam/identity/AuthMiddleware";
import { CurrentEntitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import type { Permission } from "@vantion/module-iam/identity/Permission";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer, Stream } from "effect";
import type { LanguageModel } from "effect/unstable/ai";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";
import { randomUUID } from "node:crypto";
import type { Case } from "./Cases.js";

/** What one case actually did, which is what the checks are applied to. */
export type Observation = {
  readonly id: string;
  readonly text: string;
  readonly tools: ReadonlyArray<string>;
  readonly refusals: ReadonlyArray<string>;
  readonly askedForApproval: boolean;
  /** Whether a row appeared while the approval was still unanswered. */
  readonly wroteBeforeApproval: boolean;
  readonly millis: number;
};

/**
 * The roles a case can ask as.
 *
 * `reader` is not one of the product's roles — it is a caller holding exactly
 * `contact:read`, which is how a permission refusal is provoked without
 * inventing a member whose grants would then have to be maintained twice.
 */
const identityFor = (org: string, role: string | undefined) => {
  const permissions: ReadonlyArray<Permission> = role === "reader"
    ? ["contact:read"]
    : Array.from(permissionsFor(role ?? "owner"));

  return new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role: role === "reader" ? "member" : role ?? "owner",
    permissions,
  });
};

/** What a run is configured with: which model answers, and which database. */
export type Harness = {
  readonly model: Layer.Layer<LanguageModel.LanguageModel | ModelStatus>;
  readonly pool: Layer.Layer<PgPool>;
};

export const configured: Harness = { model: layerModel, pool: PgPool.layer };

const layerFor = (org: string, role: string | undefined, harness: Harness) =>
  AssistantRpcLive.pipe(
    Layer.provideMerge(
      Layer.succeed(AuthMiddleware)(
        AuthMiddleware.of((effect) =>
          effect.pipe(
            Effect.provideService(CurrentUser, identityFor(org, role)),
            Effect.provideService(CurrentEntitlement, free),
          )
        ),
      ),
    ),
    /**
     * The model is passed in rather than read from configuration here, so the
     * suite can be run two ways from one harness: the committed gate runs the
     * scripted stand-in on every push, and a real model runs against its own
     * recorded baseline when somebody has a key. The report names which
     * answered, because a score without that means nothing.
     */
    Layer.provideMerge(harness.model),
    Layer.provideMerge(AgentModule),
    Layer.provideMerge(ContactStore.layer),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(harness.pool),
  );

/** Each case gets a tenant of its own, so one case cannot see another's writes. */
const seed = Effect.fnUntraced(function*(org: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;
  yield* sql`insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
             values (${`user_${org}`}, ${org}, ${`${org}@example.com`}, true, now(), now())
             on conflict ("id") do nothing`;
  yield* withOrgScopeFor(
    org,
    sql`insert into "contact" ("id", "organizationId", "email", "fullName")
        values (${`${org}_ada`}, ${org}, 'ada@example.com', 'Ada Lovelace')
        on conflict ("id") do nothing`,
  );

  // A second tenant with a recognisable contact, so a leak would be visible in
  // the answer rather than merely absent from it.
  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values ('othertenant', 'othertenant', 'othertenant', now())
             on conflict ("id") do nothing`;
  yield* withOrgScopeFor(
    "othertenant",
    sql`insert into "contact" ("id", "organizationId", "email", "fullName")
        values ('othertenant_secret', 'othertenant', 'secret@othertenant.test', 'othertenant')
        on conflict ("id") do nothing`,
  );
});

export const observe = (testCase: Case, harness: Harness = configured) =>
  Effect.gen(function*() {
    const org = `eval_${testCase.id.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${
      randomUUID().slice(0, 8)
    }`;
    const started = Date.now();

    return yield* Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient;
      const client = yield* RpcTest.makeClient(AssistantRpcs);

      yield* seed(org);

      const conversation = yield* client.StartConversation();
      const chunks = yield* Stream.runCollect(
        client.SendMessage({ conversationId: conversation.id, text: testCase.input }),
      );

      const approval = chunks.find((chunk) => chunk._tag === "Approval");

      // Asked while the decision is still open, which is the only moment the
      // gate can be observed to hold.
      const rows = yield* sql`select 1 from "contact" where "organizationId" = ${org}`;

      return {
        id: testCase.id,
        text: chunks.filter((chunk) => chunk._tag === "Text").map((chunk) => chunk.text).join(""),
        /**
         * Proposed calls count.
         *
         * A tool that stops for approval never produces a result, so the
         * stream names it only in the approval request — but the model did
         * reach for it, and that is what `expected_tools` is asking about.
         */
        tools: [
          ...chunks.filter((chunk) => chunk._tag === "Tool").map((chunk) => chunk.name),
          ...(approval === undefined ? [] : [approval.tool]),
        ],
        refusals: chunks
          .filter((chunk) => chunk._tag === "Tool")
          .flatMap((chunk) => chunk.refused === null ? [] : [chunk.refused]),
        askedForApproval: approval !== undefined,
        // One contact is seeded, so anything beyond it was written by the turn.
        wroteBeforeApproval: approval !== undefined && rows.length > 1,
        millis: Date.now() - started,
      } satisfies Observation;
    }).pipe(Effect.scoped, Effect.provide(layerFor(org, testCase.as_role, harness)));
  });
