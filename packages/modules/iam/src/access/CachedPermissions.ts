import { Config, Context, Duration, Effect, Layer, Schema } from "effect";
import { Persistable, PersistedCache, Persistence } from "effect/unstable/persistence";
import { PermissionSchema } from "../identity/Permission.js";
import { PermissionResolver } from "./PermissionResolver.js";

/**
 * Caching what a person may do, and why it is **off by default**.
 *
 * `PermissionResolver` runs two queries on every authenticated request, so it
 * is an obvious thing to cache and a bad thing to cache carelessly. The
 * entitlement cache next door is comfortable because a plan changes when Stripe
 * says so, and Stripe's webhook already arrives seconds to minutes after the
 * customer pressed the button — a cache measured in seconds sits inside a delay
 * the product has anyway.
 *
 * A revoked permission has no such delay to hide in. An administrator who takes
 * `member:delete` away from somebody expects it gone, and this repository has
 * spent real effort making sure a revoke is actually a revoke.
 *
 * So `PERMISSION_CACHE_TTL` is `0` unless somebody sets it, and zero means no
 * cache at all — the resolver is passed through untouched. Turning it on is a
 * deliberate act by somebody who has a measured reason, and the windows below
 * are what they are buying.
 *
 * **What invalidation covers.** A change to one member — an override set or
 * cleared, a role reassigned — drops that member's entry from the shared store,
 * so it lands on the next request on every replica.
 *
 * **What it does not.** Editing a *custom role's* permissions changes what
 * everybody holding that role may do, and there is no single key for "everybody
 * with role X". Worse, those edits go through better-auth's own dynamic
 * access-control endpoints, which this module does not wrap. That class of
 * change is bounded by the TTL and nothing else, which is the honest reason the
 * default is off and the suggested value is small.
 */

const PERMISSION_CACHE_TTL = Config.Int("PERMISSION_CACHE_TTL").pipe(
  Config.withDefault(0),
);

class PermissionsFor extends Persistable.Class<{
  payload: { organizationId: string; memberId: string; role: string; };
}>()("PermissionsFor", {
  // The role is part of the key, not just the lookup: reassigning somebody
  // produces a different entry rather than reusing the one their old role left.
  primaryKey: ({ organizationId, memberId, role }) => `${organizationId}:${memberId}:${role}`,
  success: Schema.Array(PermissionSchema),
}) {}

/** Lets a write drop what it just made wrong. */
export class PermissionCache extends Context.Service<PermissionCache, {
  readonly invalidate: (
    options: {
      readonly organizationId: string;
      readonly memberId: string;
      readonly role: string;
    },
  ) => Effect.Effect<void>;
}>()("PermissionCache") {
  /** When nothing is cached, forgetting is free and correct. */
  static layerNoop: Layer.Layer<PermissionCache> = Layer.succeed(PermissionCache)({
    invalidate: () => Effect.void,
  });
}

/**
 * Wraps whatever `PermissionResolver` is already in the graph.
 *
 * Returns the inner resolver unchanged when the TTL is zero, so "off" costs
 * nothing rather than being a cache with a zero lifetime — a distinction that
 * matters because the latter still pays a round trip to the store on every
 * request to discover the entry has expired.
 */
export const layerCachedPermissions: Layer.Layer<
  PermissionResolver | PermissionCache,
  never,
  PermissionResolver | Persistence.Persistence
> = Layer.effectContext(
  Effect.gen(function*() {
    const inner = yield* PermissionResolver;
    const seconds = yield* PERMISSION_CACHE_TTL.pipe(Effect.orDie);

    if (seconds <= 0) {
      return Context.make(PermissionResolver, inner).pipe(
        Context.add(PermissionCache, { invalidate: () => Effect.void }),
      );
    }

    const cache = yield* PersistedCache.make(
      (request: PermissionsFor) =>
        inner.resolve({
          organizationId: request.organizationId,
          memberId: request.memberId,
          role: request.role,
        }),
      {
        storeId: "iam/permissions",
        timeToLive: () => Duration.seconds(seconds),
        /**
         * The in-process layer is a quarter of the shared one and at most two
         * seconds, because invalidating on one replica cannot reach into
         * another's memory — this is the real worst case for a revoke made
         * elsewhere.
         */
        inMemoryTTL: () => Duration.seconds(Math.min(2, Math.max(1, Math.floor(seconds / 4)))),
      },
    );

    return Context.make(PermissionResolver, {
      resolve: (options) =>
        cache.get(new PermissionsFor(options)).pipe(
          Effect.map((permissions) => Array.from(permissions)),
          // A cache that cannot be reached must not refuse the request, and
          // must not fail open either: the inner resolver is the answer.
          Effect.catchCause(() => inner.resolve(options)),
        ),
    }).pipe(
      Context.add(PermissionCache, {
        invalidate: (options) => cache.invalidate(new PermissionsFor(options)).pipe(Effect.ignore),
      }),
    );
  }),
);
