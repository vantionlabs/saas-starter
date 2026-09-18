import { Context, Effect, Layer } from "effect";
import type { Entitlement } from "./Entitlement.js";
import { free } from "./Entitlement.js";
import type { Identity } from "./Identity.js";

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
  /**
   * Takes the whole caller, not just their organization.
   *
   * Plans are per-organization in this starter, which is the B2B shape and the
   * only one the bundled implementation reads. Passing the identity rather than
   * an org id costs nothing and leaves the other shapes open: a plan that
   * follows a *user* across the organizations they belong to needs a different
   * implementation of this interface and nothing else.
   *
   * Two things that look like per-user plans already work without that. A
   * personal plan is a subscription on the personal organization every user gets
   * at sign-up; and members of one organization differing in what they may do is
   * `memberPermission`, which is a permission question rather than a billing one.
   */
  readonly resolve: (identity: Identity) => Effect.Effect<Entitlement>;
}

export class EntitlementResolver
  extends Context.Service<EntitlementResolver, EntitlementResolverService>()("EntitlementResolver")
{
  /** Everyone on the free plan. The default until billing is registered. */
  static layerFree: Layer.Layer<EntitlementResolver> = Layer.succeed(EntitlementResolver)({
    resolve: () => Effect.succeed(free),
  });
}
