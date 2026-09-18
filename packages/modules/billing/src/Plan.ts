import type { Plan } from "@vantion/module-iam/identity/Entitlement";
import { features } from "@vantion/module-iam/identity/Entitlement";

/**
 * The plan a Stripe price names, read from its metadata rather than matched
 * against a hard-coded price id.
 *
 * Price ids differ between every sandbox and every account, so hard-coding them
 * makes the code wrong everywhere it is not the account it was written on.
 * Metadata is a dashboard change; a price id is a deploy.
 */
export const fromPriceMetadata = (
  metadata: Record<string, string> | undefined,
): Plan | undefined => {
  const named = metadata?.["plan"];

  return named !== undefined && named in features ? named as Plan : undefined;
};
