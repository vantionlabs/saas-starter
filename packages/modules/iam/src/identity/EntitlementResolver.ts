import { Context, Effect, Layer } from "effect";
import type { Entitlement } from "./Entitlement.js";
import { free } from "./Entitlement.js";

/**
 * How the session finds out what an organization is entitled to.
 *
 * A port, with the real implementation in `@vantion/module-billing`. This
 * module does the authorising and must not know what a subscription is, or
 * where one is stored, or that Stripe exists — the dependency points from
 * billing to identity, never back.
 *
 * The default answers `free` for everyone, which is what makes the app work
 * before billing is wired at all. Same bargain as the mailer without a Resend
 * key: the feature degrades to something honest rather than refusing to start.
 */
export interface EntitlementResolverService {
  readonly resolve: (organizationId: string) => Effect.Effect<Entitlement>;
}

export class EntitlementResolver
  extends Context.Service<EntitlementResolver, EntitlementResolverService>()("EntitlementResolver")
{
  /** Everyone on the free plan. The default until billing is registered. */
  static layerFree: Layer.Layer<EntitlementResolver> = Layer.succeed(EntitlementResolver)({
    resolve: () => Effect.succeed(free),
  });
}
