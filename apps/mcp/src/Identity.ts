import { ApiKeyAuth } from "@vantion/module-iam/apikey/ApiKeyAuth";
import { CurrentEntitlement } from "@vantion/module-iam/identity/Entitlement";
import { EntitlementResolver } from "@vantion/module-iam/identity/EntitlementResolver";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { Config, Effect, Layer, Redacted } from "effect";

/**
 * Who this server is, resolved once at start-up from an API key.
 *
 * An MCP server launched by somebody's editor runs as *them*, so the identity
 * is a property of the process rather than of a request — which is what makes
 * the whole thing simple: no per-call authentication, and every tool runs
 * through the same policies as the person's own session.
 *
 * The consequence is worth stating plainly: this key is the blast radius. It
 * carries a role, and the tools can do exactly what that role can do, so a key
 * handed to an editor should be the narrowest one that does the job. `member`
 * is usually right.
 */
export const IdentityLive: Layer.Layer<
  CurrentUser | CurrentEntitlement,
  never,
  ApiKeyAuth | EntitlementResolver
> = Layer.unwrap(
  Effect.gen(function*() {
    const key = yield* Config.Redacted("VANTION_API_KEY");
    const auth = yield* ApiKeyAuth;
    const resolver = yield* EntitlementResolver;

    const identity = yield* auth.authenticate(Redacted.value(key)).pipe(
      Effect.tapError((denied) =>
        Effect.logError(`VANTION_API_KEY was ${denied.reason}. Create one at /settings/api-keys.`)
      ),
      // Nothing this process can do without a caller, and continuing with a
      // fallback identity would be the wrong kind of helpful.
      Effect.orDie,
    );

    const entitlement = yield* resolver.resolve({
      organizationId: identity.orgId,
      userId: identity.userId,
    });

    return Layer.mergeAll(
      Layer.succeed(CurrentUser)(identity),
      Layer.succeed(CurrentEntitlement)(entitlement),
    );
  }).pipe(Effect.orDie),
);
