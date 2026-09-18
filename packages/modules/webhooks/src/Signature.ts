import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing and verifying webhook deliveries.
 *
 * Both halves live here on purpose: our own tests verify with the same function
 * a customer will write against, so a change that breaks receivers breaks the
 * suite first. A signer with no verifier beside it is a scheme nobody has
 * checked from the outside.
 *
 * The format is Stripe's, deliberately — customers already have code for it and
 * there is a well-known document to point at:
 *
 *     Webhook-Signature: t=1758196800,v1=9f86d081884c7d65…
 *
 * The signed payload is `${timestamp}.${body}`, not the body alone. Including
 * the timestamp is what makes a captured request expire rather than stay valid
 * forever, and putting it inside the HMAC is what stops an attacker editing it.
 */

export const SIGNATURE_HEADER = "webhook-signature";
export const ID_HEADER = "webhook-id";

/** How far out of step a receiver's clock may be before a delivery is refused. */
export const TOLERANCE_SECONDS = 300;

const digest = (secret: string, timestamp: number, body: string): string =>
  createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

export const sign = (options: {
  readonly secret: string;
  readonly body: string;
  readonly at?: Date;
}): string => {
  const timestamp = Math.floor((options.at ?? new Date()).getTime() / 1000);

  return `t=${timestamp},v1=${digest(options.secret, timestamp, options.body)}`;
};

export type VerificationFailure =
  | "Malformed"
  | "Expired"
  | "Mismatch";

const parse = (header: string): { readonly t: number; readonly v1: string; } | undefined => {
  const parts = new Map(
    header.split(",").map((part) => {
      const [key, value] = part.trim().split("=", 2);
      return [key ?? "", value ?? ""] as const;
    }),
  );

  const t = Number(parts.get("t"));
  const v1 = parts.get("v1");

  if (!Number.isInteger(t) || v1 === undefined || !/^[0-9a-f]+$/.test(v1)) return undefined;

  return { t, v1 };
};

/**
 * `undefined` when the delivery is authentic, otherwise why it is not.
 *
 * The comparison is constant-time. A byte-by-byte one leaks how much of a forged
 * signature was right, which is enough to find the rest.
 */
export const verify = (options: {
  readonly secret: string;
  readonly body: string;
  readonly header: string;
  readonly now?: Date;
  readonly toleranceSeconds?: number;
}): VerificationFailure | undefined => {
  const parsed = parse(options.header);
  if (parsed === undefined) return "Malformed";

  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const tolerance = options.toleranceSeconds ?? TOLERANCE_SECONDS;

  if (Math.abs(now - parsed.t) > tolerance) return "Expired";

  const expected = Buffer.from(digest(options.secret, parsed.t, options.body), "utf8");
  const presented = Buffer.from(parsed.v1, "utf8");

  // `timingSafeEqual` throws on a length mismatch, which is itself a comparison
  // worth not leaking through an exception.
  if (expected.length !== presented.length) return "Mismatch";

  return timingSafeEqual(expected, presented) ? undefined : "Mismatch";
};
