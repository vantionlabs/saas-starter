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

const attemptSignIn = (request: APIRequestContext, address: string, origin = API_URL) =>
  request.post(`${origin}/api/auth/sign-in/email`, {
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

  /**
   * Browsers reach these endpoints through the web app, which forwards them to
   * the API — so the limit has to survive that hop. The proxy passes
   * `X-Forwarded-For` through untouched; had it appended its own view, every
   * caller would arrive from the web server and share one bucket. The second
   * half is what catches that: one caller exhausting the allowance must not
   * throttle another.
   */
  test("counts each caller separately through the web app's origin", async ({ request }) => {
    const exhausted = "198.51.100.44";
    const bystander = "198.51.100.45";

    const statuses: Array<number> = [];
    for (let attempt = 0; attempt < LIMIT + 2; attempt += 1) {
      statuses.push((await attemptSignIn(request, exhausted, WEB_URL)).status());
    }

    expect(statuses).toContain(429);
    expect((await attemptSignIn(request, bystander, WEB_URL)).status()).not.toBe(429);
  });
});
