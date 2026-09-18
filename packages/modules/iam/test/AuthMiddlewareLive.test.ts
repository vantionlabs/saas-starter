import { AuditLog } from "@/AuditLog.js";
import { Auth } from "@/Auth.js";
import { AuthMiddlewareLive } from "@/AuthMiddlewareLive.js";
import { IamRpcLive } from "@/IamRpcLive.js";
import type { AuthSession } from "@/Options.js";
import { PermissionResolver } from "@/PermissionResolver.js";
import { describe, expect, it } from "@effect/vitest";
import { IamRpcs } from "@vantion/module-iam/IamRpc";
import { permissionsFor } from "@vantion/module-iam/Permission";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";

/**
 * better-auth is the one true external boundary here, so it is the only thing
 * swapped — the middleware, the group and the handler are production wiring.
 */
const authReturning = (session: AuthSession | null) =>
  Layer.succeed(Auth)({
    handler: () => Promise.resolve(new Response()),
    getSession: () => Promise.resolve(session),
  });

const signedIn: AuthSession = {
  user: { id: "user_123", email: "someone@example.com", emailVerified: true },
  session: { id: "session_123", activeOrganizationId: "org_123" },
};

/** Resolution is exercised on its own; here it just mirrors the role. */
const resolverFromRole = Layer.succeed(PermissionResolver)({
  resolve: ({ role }) => Effect.succeed(Array.from(permissionsFor(role))),
});

const testLayer = (session: AuthSession | null) =>
  IamRpcLive.pipe(
    Layer.provideMerge(AuthMiddlewareLive),
    Layer.provide(authReturning(session)),
    Layer.provide(resolverFromRole),
    // This test is about resolving an identity, not about auditing, and it
    // deliberately runs without a database.
    Layer.provide(AuditLog.layerNoop),
  );

describe("AuthMiddlewareLive", () => {
  it.effect("provides CurrentUser from a resolved session", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(IamRpcs);

      const identity = yield* client.Me();

      expect(identity.userId).toBe("user_123");
      expect(identity.orgId).toBe("org_123");
      expect(identity.email).toBe("someone@example.com");
    }).pipe(Effect.provide(testLayer(signedIn))));

  it.effect("fails Unauthenticated/NoSession when there is no session", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(IamRpcs);

      const error = yield* Effect.flip(client.Me());

      expect(error._tag).toBe("Unauthenticated");
      expect(error.reason).toBe("NoSession");
    }).pipe(Effect.provide(testLayer(null))));

  it.effect("refuses to guess an org when the session has none", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(IamRpcs);

      const error = yield* Effect.flip(client.Me());

      expect(error.reason).toBe("NoActiveOrganization");
    }).pipe(
      Effect.provide(
        testLayer({ ...signedIn, session: { id: "session_123", activeOrganizationId: null } }),
      ),
    ));
});
