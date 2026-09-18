import { Config, Option } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";

/**
 * How many reverse proxies stand between the internet and this process.
 *
 * Zero — the default — means the socket address is the client, and
 * `X-Forwarded-For` is ignored entirely. That is the safe default precisely
 * because it is the wrong answer behind a proxy: a misconfiguration then
 * lumps every caller into one bucket, which is noticed, rather than handing
 * each caller an unlimited supply of them, which is not.
 *
 * On Railway, and behind most single load balancers, this is `1`.
 */
export const TrustedProxyCount = Config.int("TRUST_PROXY").pipe(Config.withDefault(0));

/**
 * The address to hold a caller responsible for.
 *
 * `X-Forwarded-For` is a list that each proxy appends to, so the entry a given
 * hop actually observed is counted from the *right*. The leftmost entry is
 * whatever the original client sent, which is to say whatever it wanted: taking
 * that one lets a caller mint a new identity per request simply by varying a
 * header, and any rate limit keyed on it stops being a limit at all.
 *
 * With `trustedProxies` hops in front, the address the outermost trusted proxy
 * saw sits `trustedProxies` from the end. A header with fewer entries than that
 * did not come through the chain this server was told to expect, so it is not
 * evidence of anything and the socket address is used instead.
 */
export const clientAddress = (
  request: HttpServerRequest.HttpServerRequest,
  trustedProxies: number,
): string => {
  const direct = Option.getOrUndefined(request.remoteAddress);

  if (trustedProxies <= 0) return direct ?? "unknown";

  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded === undefined) return direct ?? "unknown";

  const entries = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  const index = entries.length - trustedProxies;

  return index >= 0 ? entries[index] ?? direct ?? "unknown" : direct ?? "unknown";
};
