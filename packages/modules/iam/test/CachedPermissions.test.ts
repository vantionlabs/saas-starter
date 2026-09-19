import { layerCachedPermissions, PermissionCache } from "@/access/CachedPermissions.js";
import { PermissionResolver } from "@/access/PermissionResolver.js";
import type { Permission } from "@/identity/Permission.js";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Ref } from "effect";
import { Persistence } from "effect/unstable/persistence";

const KEY = { organizationId: "org", memberId: "m1", role: "admin" } as const;

/** A resolver that counts, so "was the database asked?" is observable. */
const counting = (
  granted: Ref.Ref<ReadonlyArray<Permission>>,
  calls: Ref.Ref<number>,
) =>
  Layer.succeed(PermissionResolver)({
    resolve: () =>
      Effect.gen(function*() {
        yield* Ref.update(calls, (n) => n + 1);

        return Array.from(yield* Ref.get(granted));
      }),
  });

const run = <A, E>(
  ttl: string,
  effect: (refs: {
    readonly granted: Ref.Ref<ReadonlyArray<Permission>>;
    readonly calls: Ref.Ref<number>;
  }) => Effect.Effect<A, E, PermissionResolver | PermissionCache>,
) =>
  Effect.gen(function*() {
    const granted = yield* Ref.make<ReadonlyArray<Permission>>(["member:delete"]);
    const calls = yield* Ref.make(0);

    return yield* effect({ granted, calls }).pipe(
      Effect.provide(
        layerCachedPermissions.pipe(
          Layer.provide(counting(granted, calls)),
          Layer.provide(Persistence.layerMemory),
        ),
      ),
      Effect.provide(
        ConfigProvider.layer(ConfigProvider.fromEnvRecord({ PERMISSION_CACHE_TTL: ttl })),
      ),
    );
  });

describe("the permission cache", () => {
  /**
   * Off is the default, and off must mean *absent* rather than a cache with a
   * zero lifetime — the latter still asks the store on every request to learn
   * the entry has expired, which is the cost without the benefit.
   */
  it.effect("does nothing at all unless a TTL is configured", () =>
    run("0", ({ calls }) =>
      Effect.gen(function*() {
        const resolver = yield* PermissionResolver;

        yield* resolver.resolve(KEY);
        yield* resolver.resolve(KEY);
        yield* resolver.resolve(KEY);

        expect(yield* Ref.get(calls), "a request was answered from a cache").toBe(3);
      })));

  it.effect("asks once when it is on", () =>
    run("30", ({ calls }) =>
      Effect.gen(function*() {
        const resolver = yield* PermissionResolver;

        yield* resolver.resolve(KEY);
        yield* resolver.resolve(KEY);

        expect(yield* Ref.get(calls)).toBe(1);
      })));

  /**
   * The one that matters. An administrator taking a permission away expects it
   * gone, so the write invalidates rather than trusting a clock — and because
   * the store is shared, that reaches every replica rather than the one that
   * handled the request.
   */
  it.effect("forgets a member on demand, so a revoke lands on the next request", () =>
    run("30", ({ calls, granted }) =>
      Effect.gen(function*() {
        const resolver = yield* PermissionResolver;
        const cache = yield* PermissionCache;

        expect(yield* resolver.resolve(KEY)).toContain("member:delete");

        // What `ClearMemberOverride` does: the row changes, then the entry goes.
        yield* Ref.set(granted, []);
        yield* cache.invalidate(KEY);

        expect(yield* resolver.resolve(KEY)).not.toContain("member:delete");
        expect(yield* Ref.get(calls)).toBe(2);
      })));

  /**
   * The role is in the key, not only in the lookup. Reassigning somebody must
   * not hand them what their previous role left cached.
   */
  it.effect("does not answer for a role the entry was not computed under", () =>
    run("30", ({ calls }) =>
      Effect.gen(function*() {
        const resolver = yield* PermissionResolver;

        yield* resolver.resolve(KEY);
        yield* resolver.resolve({ ...KEY, role: "member" });

        expect(yield* Ref.get(calls)).toBe(2);
      })));
});
