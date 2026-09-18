import { describe, expect, it } from "@effect/vitest";
import { CurrentEntitlement, Entitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import type { Role } from "@vantion/module-iam/identity/Permission";
import { permissionsFor, resolvePermissions } from "@vantion/module-iam/identity/Permission";
import { all, any, feature, Forbidden, permission } from "@vantion/module-iam/identity/Policy";
import { Effect, Layer } from "effect";

const as = (role: Role) =>
  Layer.succeed(CurrentUser)(
    new Identity({
      userId: UserId.make("user_1"),
      orgId: OrgId.make("org_1"),
      email: "someone@example.com",
      emailVerified: true,
      role,
      permissions: Array.from(permissionsFor(role)),
    }),
  );

describe("permissionsFor", () => {
  it("gives an owner strictly more than an admin", () => {
    const owner = permissionsFor("owner");
    const admin = permissionsFor("admin");

    expect(admin.has("organization:delete")).toBe(false);
    expect(owner.has("organization:delete")).toBe(true);
    // Everything an admin can do, an owner can do.
    for (const granted of admin) expect(owner.has(granted)).toBe(true);
  });

  it("does not let a member manage other members", () => {
    const member = permissionsFor("member");

    expect(member.has("contact:read")).toBe(true);
    expect(member.has("member:create")).toBe(false);
    expect(member.has("member:delete")).toBe(false);
  });
});

describe("policies", () => {
  it.effect("allow the role that holds the permission", () =>
    permission("organization:delete").pipe(Effect.provide(as("owner"))));

  it.effect("deny the role that does not, naming what was required", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(permission("organization:delete"));

      expect(error).toBeInstanceOf(Forbidden);
      expect(error.required).toBe("organization:delete");
    }).pipe(Effect.provide(as("admin"))));

  it.effect("`all` fails when any policy fails", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        all(permission("contact:read"), permission("organization:delete")),
      );

      expect(error.required).toBe("organization:delete");
    }).pipe(Effect.provide(as("member"))));

  it.effect("`any` succeeds when one policy passes", () =>
    any(permission("organization:delete"), permission("contact:read")).pipe(
      Effect.provide(as("member")),
    ));
});

describe("resolvePermissions", () => {
  it("starts a custom role from nothing, then adds its grants", () => {
    const resolved = resolvePermissions({
      role: "editor",
      customRoleGrants: ["contact:read", "contact:update"],
      overrides: [],
    });

    expect(Array.from(resolved).sort()).toEqual(["contact:read", "contact:update"]);
  });

  it("lets an override revoke something the role grants", () => {
    const resolved = resolvePermissions({
      role: "admin",
      customRoleGrants: [],
      overrides: [{ permission: "member:delete", granted: false }],
    });

    expect(permissionsFor("admin").has("member:delete")).toBe(true);
    expect(resolved.has("member:delete")).toBe(false);
    // Everything else the role gave is untouched.
    expect(resolved.has("member:create")).toBe(true);
  });

  it("lets an override grant something the role does not", () => {
    const resolved = resolvePermissions({
      role: "member",
      customRoleGrants: [],
      overrides: [{ permission: "invitation:create", granted: true }],
    });

    expect(resolved.has("invitation:create")).toBe(true);
  });

  it("applies revokes after custom-role grants, so a revoke wins", () => {
    const resolved = resolvePermissions({
      role: "member",
      customRoleGrants: ["contact:delete"],
      overrides: [{ permission: "contact:delete", granted: false }],
    });

    expect(resolved.has("contact:delete")).toBe(false);
  });
});

const onPlan = (plan: "free" | "pro" | "scale") =>
  Layer.succeed(CurrentEntitlement)(
    plan === "free" ? free : new Entitlement({ plan, status: "active", seats: 25 }),
  );

describe("feature", () => {
  it.effect("allows what the organization's plan carries", () =>
    feature("custom_roles").pipe(Effect.provide(Layer.mergeAll(as("owner"), onPlan("pro")))));

  it.effect("refuses what it does not, naming the plan rather than the permission", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.flip(feature("custom_roles"));

      expect(outcome).toBeInstanceOf(Forbidden);
      expect(outcome.required).toBe("plan:custom_roles");
    }).pipe(Effect.provide(Layer.mergeAll(as("owner"), onPlan("free")))));

  /**
   * The composition the whole design rests on. An owner has every permission and
   * still cannot use a feature their organization has not paid for — and a payer
   * on the top plan still cannot do what their role forbids.
   */
  it.effect("is not satisfied by a permission, however senior", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.flip(
        all(permission("ac:create"), feature("custom_roles")),
      );

      expect(outcome.required).toBe("plan:custom_roles");
    }).pipe(Effect.provide(Layer.mergeAll(as("owner"), onPlan("free")))));

  it.effect("does not satisfy a permission either", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.flip(
        all(permission("organization:delete"), feature("custom_roles")),
      );

      expect(outcome.required).toBe("organization:delete");
    }).pipe(Effect.provide(Layer.mergeAll(as("member"), onPlan("scale")))));

  /** An ended subscription falls back to free, so the gate closes with it. */
  it.effect("closes when the subscription is no longer entitled", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.flip(feature("custom_roles"));

      expect(outcome.required).toBe("plan:custom_roles");
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          as("owner"),
          Layer.succeed(CurrentEntitlement)(
            new Entitlement({ plan: "scale", status: "canceled", seats: 250 }),
          ),
        ),
      ),
    ));
});
