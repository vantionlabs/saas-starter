import { Context, Duration, Effect, Layer } from "effect";
import { Persistable, PersistedCache, Persistence } from "effect/unstable/persistence";
import { Entitlement } from "./Entitlement.js";
import { EntitlementResolver } from "./EntitlementResolver.js";

/**
 * Caching an authorisation decision, and the window that opens.
 *
 * Every authenticated request resolves two things from Postgres: what the
 * organization is paying for, and what the person may do. Both are read on the
 * hottest path in the product and both change rarely, which is the textbook
 * case for a cache — and both are *authorisation*, which is the case where a
 * cache is a security decision rather than a performance one.
 *
 * So the numbers below are the whole design, and they are stated rather than
 * defaulted.
 *
 * **Invalidation is explicit, and that is why the store is shared.** Removing an
 * entry takes it out of Redis for every replica at once, so a plan change or a
 * revoked permission does not wait for a TTL anywhere — which matters, because
 * Effect ships no Redis-backed pub/sub to announce it with.
 *
 * **What a TTL still bounds is the in-process layer.** `PersistedCache` keeps a
 * small local cache in front of the store, and invalidating on one replica
 * cannot reach into another's memory. `inMemoryTTL` is therefore the real
 * worst-case staleness after a change made elsewhere, and it is deliberately
 * short.
 */

/** Thirty seconds in the shared store, two in each process's own. */
const ENTITLEMENT_TTL = Duration.seconds(30);
const ENTITLEMENT_MEMORY_TTL = Duration.seconds(2);

class PlanFor extends Persistable.Class<{ payload: { organizationId: string; }; }>()(
  "PlanFor",
  {
    primaryKey: ({ organizationId }) => organizationId,
    success: Entitlement,
  },
) {}

/**
 * The entitlement resolver, cached.
 *
 * Safer than caching permissions, and it is worth saying why rather than
 * leaving it implied: a plan changes when Stripe says so, and Stripe's webhook
 * already arrives seconds to minutes after the customer pressed the button. A
 * cache measured in seconds is inside the delay the product already has, and
 * `/settings/billing` already tells people the plan updates once Stripe
 * confirms it.
 *
 * The direction that matters is *downgrade*, and it is handled by
 * invalidation rather than by the TTL: the webhook that writes the subscription
 * removes the entry, so a cancelled plan stops entitling on the next request
 * everywhere.
 */
/**
 * Lets whatever changed a subscription drop the cached plan.
 *
 * A service of its own rather than a method on `EntitlementResolver`, so every
 * consumer of the resolver does not acquire a method it has no business
 * calling. The billing module holds this one; the middleware holds the other.
 */
export class EntitlementCache extends Context.Service<EntitlementCache, {
  readonly invalidate: (organizationId: string) => Effect.Effect<void>;
}>()("EntitlementCache") {
  /** When nothing is cached, forgetting is free and correct. */
  static layerNoop: Layer.Layer<EntitlementCache> = Layer.succeed(EntitlementCache)({
    invalidate: () => Effect.void,
  });
}

/**
 * The entitlement resolver, cached, and the invalidation handle beside it.
 *
 * Safer to cache than permissions, and worth saying why rather than leaving it
 * implied: a plan changes when Stripe says so, and Stripe's webhook already
 * arrives seconds to minutes after the customer pressed the button. A cache
 * measured in seconds sits inside a delay the product already has, and
 * `/settings/billing` already tells people the plan updates once Stripe
 * confirms it.
 *
 * The direction that matters is a **downgrade**, and it is handled by
 * invalidation rather than by the clock: the webhook that writes the
 * subscription drops the entry, so a cancelled plan stops entitling on the next
 * request on every replica.
 */
export const layerCachedEntitlements: Layer.Layer<
  EntitlementResolver | EntitlementCache,
  never,
  EntitlementResolver | Persistence.Persistence
> = Layer.effectContext(
  Effect.gen(function*() {
    const inner = yield* EntitlementResolver;

    const cache = yield* PersistedCache.make(
      (request: PlanFor) => inner.resolve({ organizationId: request.organizationId }),
      {
        storeId: "iam/entitlement",
        timeToLive: () => ENTITLEMENT_TTL,
        inMemoryTTL: () => ENTITLEMENT_MEMORY_TTL,
      },
    );

    return Context.make(EntitlementResolver, {
      resolve: (subject) =>
        cache.get(new PlanFor({ organizationId: subject.organizationId })).pipe(
          /**
           * A cache that cannot be reached must not refuse the request. Falling
           * through to the database is slower and correct; failing is neither.
           */
          Effect.catchCause(() => inner.resolve(subject)),
        ),
    }).pipe(
      Context.add(EntitlementCache, {
        invalidate: (organizationId) =>
          cache.invalidate(new PlanFor({ organizationId })).pipe(Effect.ignore),
      }),
    );
  }),
);
