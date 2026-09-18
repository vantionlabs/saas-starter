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
/**
 * Who is being asked about.
 *
 * The organization always; the user when there is one. Not the whole `Identity`,
 * because an entitlement has no business reading somebody's permissions or
 * email — and because the seat limit is asked before any caller exists, from
 * inside better-auth's invitation endpoint, where an organization is all there
 * is.
 */
export type Subject = {
  readonly organizationId: string;
  readonly userId?: string;
};

export interface EntitlementResolverService {
  /**
   * Plans are per-organization in this starter, which is the B2B shape and the
   * only one the bundled implementation reads. `userId` is passed when known so
   * the other shapes stay open: a plan that follows a *user* across the
   * organizations they belong to needs a different implementation of this
   * interface and nothing else.
   *
   * Two things that look like per-user plans already work without that. A
   * personal plan is a subscription on the personal organization every user gets
   * at sign-up; and members of one organization differing in what they may do is
   * `memberPermission`, which is a permission question rather than a billing one.
   */
  readonly resolve: (subject: Subject) => Effect.Effect<Entitlement>;
}

export class EntitlementResolver
  extends Context.Service<EntitlementResolver, EntitlementResolverService>()("EntitlementResolver")
{
  /** Everyone on the free plan. The default until billing is registered. */
  static layerFree: Layer.Layer<EntitlementResolver> = Layer.succeed(EntitlementResolver)({
    resolve: () => Effect.succeed(free),
  });
}
