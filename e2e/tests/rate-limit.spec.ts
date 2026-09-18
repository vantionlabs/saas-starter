import type { APIRequestContext } from "@playwright/test";
import { API_URL, expect, PASSWORD, test, uniqueEmail, WEB_URL } from "../fixtures.js";

/**
 * The credential endpoints allow ten attempts a minute per caller.
 *
 * This is the one limit that is itself the security boundary rather than a
 * politeness measure: a six-digit OTP carries about twenty bits, so it is only
 * as strong as the number of guesses allowed. A regression here does not break
 * a feature, it quietly removes a control — which is exactly the kind of thing
 * no one notices without a test.
 */
const LIMIT = 10;

const attemptSignIn = (request: APIRequestContext, address: string) =>
  request.post(`${API_URL}/api/auth/sign-in/email`, {
    headers: {
      "content-type": "application/json",
      origin: WEB_URL,
      "x-forwarded-for": address,
    },
    data: { email: uniqueEmail("throttled"), password: PASSWORD },
    failOnStatusCode: false,
  });

test.describe("auth rate limiting", () => {
  test("throttles a caller that exceeds the limit", async ({ request }) => {
    // Its own address, so exhausting this bucket cannot fail another test.
    const address = "198.51.100.42";

    const statuses: Array<number> = [];
    for (let attempt = 0; attempt < LIMIT + 2; attempt += 1) {
      statuses.push((await attemptSignIn(request, address)).status());
    }

    expect(statuses).toContain(429);

    // The limit must bite after the allowance, not before it.
    expect(statuses.slice(0, LIMIT)).not.toContain(429);
  });

  /**
   * The regression test for the header being read from the right.
   *
   * A caller prepending its own `X-Forwarded-For` entries used to mint a fresh
   * bucket per request, because the leftmost value — the one it controls — was
   * the one counted. With one proxy trusted the rightmost entry is what counts,
   * and that is the one Playwright appends here, so all of these land in a
   * single bucket however much the caller invents to its left.
   */
  test("cannot be evaded by inventing forwarded-for entries", async ({ request }) => {
    const address = "198.51.100.43";

    const statuses: Array<number> = [];
    for (let attempt = 0; attempt < LIMIT + 2; attempt += 1) {
      statuses.push((await attemptSignIn(request, `10.0.0.${attempt}, ${address}`)).status());
    }

    expect(statuses).toContain(429);
  });
});
