import { EntitlementCache, layerCachedEntitlements } from "@/identity/Cached.js";
import { Entitlement } from "@/identity/Entitlement.js";
import { EntitlementResolver } from "@/identity/EntitlementResolver.js";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import { Persistence } from "effect/unstable/persistence";

const ORG = "cache_org";

/**
 * A resolver that counts, so "was the database asked?" is observable.
 *
 * The plan it returns is read from a `Ref`, which is how a change made
 * elsewhere — a Stripe webhook on another replica — is simulated without one.
 */
const counting = (plan: Ref.Ref<"free" | "scale">, calls: Ref.Ref<number>) =>
  Layer.succeed(EntitlementResolver)({
    resolve: () =>
      Effect.gen(function*() {
        yield* Ref.update(calls, (n) => n + 1);

        return new Entitlement({
          plan: yield* Ref.get(plan),
          status: "active",
          seats: 3,
        });
      }),
  });

const run = <A, E>(
  effect: (refs: {
    readonly plan: Ref.Ref<"free" | "scale">;
    readonly calls: Ref.Ref<number>;
  }) => Effect.Effect<A, E, EntitlementResolver | EntitlementCache>,
) =>
  Effect.gen(function*() {
    const plan = yield* Ref.make<"free" | "scale">("scale");
    const calls = yield* Ref.make(0);

    return yield* effect({ plan, calls }).pipe(
      Effect.provide(
        layerCachedEntitlements.pipe(
          Layer.provide(counting(plan, calls)),
          Layer.provide(Persistence.layerMemory),
        ),
      ),
    );
  });

describe("the entitlement cache", () => {
  it.effect("asks the database once and answers the rest itself", () =>
    run(({ calls }) =>
      Effect.gen(function*() {
        const resolver = yield* EntitlementResolver;

        for (let i = 0; i < 5; i += 1) {
          expect((yield* resolver.resolve({ organizationId: ORG })).plan).toBe("scale");
        }

        expect(yield* Ref.get(calls)).toBe(1);
      })
    ));

  /**
   * The property the shared store exists for, and the reason a downgrade does
   * not wait for a clock.
   *
   * A cancelled subscription that kept entitling until a TTL expired would be
   * the expensive direction of being wrong, so the webhook drops the entry
   * rather than trusting it to lapse.
   */
  it.effect("forgets on demand, so a downgrade lands on the next request", () =>
    run(({ calls, plan }) =>
      Effect.gen(function*() {
        const resolver = yield* EntitlementResolver;
        const cache = yield* EntitlementCache;

        expect((yield* resolver.resolve({ organizationId: ORG })).plan).toBe("scale");

        // What a Stripe webhook does: the row changes, then the entry is dropped.
        yield* Ref.set(plan, "free");
        yield* cache.invalidate(ORG);

        expect((yield* resolver.resolve({ organizationId: ORG })).plan).toBe("free");
        expect(yield* Ref.get(calls)).toBe(2);
      })
    ));

  it.effect("keeps organizations apart", () =>
    run(({ calls }) =>
      Effect.gen(function*() {
        const resolver = yield* EntitlementResolver;

        yield* resolver.resolve({ organizationId: "one" });
        yield* resolver.resolve({ organizationId: "two" });

        expect(yield* Ref.get(calls), "one organization's plan answered another's").toBe(2);
      })
    ));
});
