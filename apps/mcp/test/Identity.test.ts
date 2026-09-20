import { IdentityLive } from "@/Identity.js";
import { describe, expect, it } from "@effect/vitest";
import { ApiKeyAuth, ApiKeyDenied } from "@vantion/module-iam/apikey/ApiKeyAuth";
import { CurrentEntitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { EntitlementResolver } from "@vantion/module-iam/identity/EntitlementResolver";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { ConfigProvider, Effect, Exit, Layer } from "effect";

const caller = new Identity({
  userId: UserId.make("key_7f3a"),
  orgId: OrgId.make("org_acme"),
  email: "key_7f3a@apikey.local",
  emailVerified: true,
  role: "member",
  permissions: Array.from(permissionsFor("member")),
});

/**
 * The real `ApiKeyAuth` needs a database and a permission resolver, and neither
 * is what this file is about: what matters here is what the *process* does with
 * the answer, which is the part `apps/mcp` owns.
 */
const auth = (answer: Effect.Effect<Identity, ApiKeyDenied>) =>
  Layer.succeed(ApiKeyAuth)(ApiKeyAuth.of({ authenticate: () => answer }));

const resolver = Layer.succeed(EntitlementResolver)(
  EntitlementResolver.of({ resolve: () => Effect.succeed(free) }),
);

const withKey = (key: string) =>
  ConfigProvider.layer(ConfigProvider.fromEnvRecord({ VANTION_API_KEY: key }));

describe("the identity an MCP server runs as", () => {
  /**
   * Resolved once, at start-up, because an MCP server launched by somebody's
   * editor runs as *them* — the identity is a property of the process, not of
   * a request. That is what lets every tool go through the same policies as
   * their own session without per-call authentication.
   */
  it.effect("is the key's, and is fixed for the life of the process", () =>
    Effect.gen(function*() {
      const identity = yield* CurrentUser;

      expect(identity.orgId).toBe("org_acme");
      expect(identity.role).toBe("member");
      // A key has no person, so the audit trail names the credential.
      expect(identity.userId).toBe("key_7f3a");
    }).pipe(
      Effect.provide(
        IdentityLive.pipe(
          Layer.provide(auth(Effect.succeed(caller))),
          Layer.provide(resolver),
          Layer.provide(withKey("vantion_live_abc")),
        ),
      ),
    ));

  it.effect("carries the entitlement the organization has", () =>
    Effect.gen(function*() {
      expect((yield* CurrentEntitlement).plan).toBe("free");
    }).pipe(
      Effect.provide(
        IdentityLive.pipe(
          Layer.provide(auth(Effect.succeed(caller))),
          Layer.provide(resolver),
          Layer.provide(withKey("vantion_live_abc")),
        ),
      ),
    ));

  /**
   * The claim the source makes — "continuing with a fallback identity would be
   * the wrong kind of helpful" — asserted rather than left as a comment. A
   * rejected key must stop the process, because the alternative is an MCP
   * server that starts, answers an editor, and acts as somebody it is not.
   */
  it.effect("refuses to start on a key the server rejected", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Layer.build(
          IdentityLive.pipe(
            Layer.provide(auth(Effect.fail(new ApiKeyDenied("unknown")))),
            Layer.provide(resolver),
            Layer.provide(withKey("vantion_live_revoked")),
          ),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    }).pipe(Effect.scoped));

  /** And on no key at all, which is the commonest way to misconfigure it. */
  it.effect("refuses to start with no key configured", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Layer.build(
          IdentityLive.pipe(
            Layer.provide(auth(Effect.succeed(caller))),
            Layer.provide(resolver),
            Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({}))),
          ),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    }).pipe(Effect.scoped));
});
