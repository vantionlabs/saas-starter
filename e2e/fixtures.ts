import { expect as expectBase, type Page, test as base } from "@playwright/test";

export const API_URL = "http://localhost:3100";
export const WEB_URL = "http://localhost:5273";

/**
 * better-auth refuses a state-changing request whose `Origin` it does not
 * recognise, and answers 403 `MISSING_OR_NULL_ORIGIN` when the header is absent
 * altogether. Playwright's request context sends no `Origin` of its own, so
 * these calls supply the one the API trusts — which is what the browser would
 * have sent had the same request come from the app.
 */
const authRequestHeaders = { "content-type": "application/json", origin: WEB_URL };

/**
 * A password that satisfies the `NewPassword` schema the sign-up form enforces.
 */
export const PASSWORD = "e2e-password-1234";

let counter = 0;

/**
 * A distinct client address per test.
 *
 * The auth routes rate-limit credential endpoints to ten requests a minute per
 * caller, and the caller is its IP — so a parallel suite all arriving from
 * 127.0.0.1 shares one bucket and starts failing with 429 partway through.
 * Presenting a different forwarded address per test is what a proxy in front of
 * the API would do anyway, and it keeps the limiter itself under test rather
 * than disabled for tests.
 */
export const nextClientAddress = () => {
  counter += 1;
  const n = counter % 65_536;
  return `10.${(counter % 251) + 1}.${Math.floor(n / 256)}.${n % 256}`;
};

/**
 * A fresh address per call.
 *
 * Tests share one database and run in parallel, so identity is what keeps them
 * apart: a unique user means a unique personal organization, and every row a
 * test writes is already scoped to it. That is why no test truncates a table,
 * and why they need no ordering between them.
 */
export const uniqueEmail = (prefix = "user") => {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}@example.test`;
};

/**
 * Registers a user over better-auth's own HTTP endpoint and leaves the session
 * cookie in the browser context.
 *
 * Going through the API rather than the form is deliberate for *setup*: it is
 * one round trip instead of a page load and three interactions, and a failure
 * here is unambiguously about the fixture rather than about the form. The form
 * itself is exercised directly in `auth.spec.ts`, which is where a regression in
 * it should be reported.
 *
 * `page.request` shares the context's cookie jar, and cookies ignore port, so a
 * session set by the API on `localhost` is sent to the web server too.
 */
export const signUpViaApi = async (page: Page, email: string) => {
  const response = await page.request.post(`${API_URL}/api/auth/sign-up/email`, {
    headers: authRequestHeaders,
    data: { email, password: PASSWORD, name: email.split("@")[0] ?? "Test User" },
  });

  if (!response.ok()) {
    throw new Error(`sign-up failed for ${email}: ${response.status()} ${await response.text()}`);
  }

  return { email, password: PASSWORD };
};

/**
 * Ends the session and clears the cookie from the browser context.
 *
 * The empty `data` object is load-bearing: better-auth refuses a request with
 * no `Content-Type` outright (415), and Playwright only sets one when there is
 * a body to describe.
 */
export const signOutViaApi = async (page: Page) => {
  const response = await page.request.post(`${API_URL}/api/auth/sign-out`, {
    headers: authRequestHeaders,
    data: {},
  });

  if (!response.ok()) {
    throw new Error(`sign-out failed: ${response.status()} ${await response.text()}`);
  }
};

export type Fixtures = {
  /** A page already signed in as a brand-new user, on their own organization. */
  readonly signedIn: Page;
  /** The address `signedIn` was registered with. */
  readonly signedInEmail: string;
};

/**
 * The empty destructuring patterns below are required, not stylistic.
 *
 * Playwright reads the first argument's destructuring pattern to work out which
 * fixtures each one depends on, and rejects anything else at run time with
 * "First argument must use the object destructuring pattern". A fixture that
 * depends on nothing therefore has to spell that as `{}` — which is why
 * `eslint/no-empty-pattern` is turned off for this directory.
 */
export const test = base.extend<Fixtures>({
  extraHTTPHeaders: async ({}, use) => {
    await use({ "x-forwarded-for": nextClientAddress() });
  },

  signedInEmail: async ({}, use) => {
    await use(uniqueEmail());
  },

  signedIn: async ({ page, signedInEmail }, use) => {
    await signUpViaApi(page, signedInEmail);
    await completeOnboarding(page);
    await use(page);
  },
});

/**
 * Gets a brand-new account past the setup wizard.
 *
 * Every test here signs up its own user, and a fresh sign-up now lands on
 * `/onboarding` — so without this, every test in the suite would be asserting
 * against a wizard. It is a click rather than an HTTP call because there is no
 * endpoint to call: finishing is an RPC procedure, and hand-rolling its
 * envelope in a fixture would be testing a copy of the wire format.
 *
 * No hydration dance. That route is `ssr: "data-only"`, so the button does not
 * exist in the document until React has rendered it, which means Playwright's
 * ordinary wait for the element is already a wait for a live handler.
 *
 * `onboarding.spec.ts` skips this deliberately, since the wizard is what it is
 * about.
 */
export const completeOnboarding = async (page: Page) => {
  /**
   * Its own `goto` rather than inspecting wherever the caller happened to be.
   *
   * The gate lives in a route loader, so the redirect into the wizard is
   * resolved by the server and a full navigation lands on its final URL — while
   * a client-side one, such as the hop a sign-in makes, passes through `/` on
   * the way. Reading the URL at that moment saw `/`, returned having done
   * nothing, and failed fifteen seconds later on an assertion about the
   * dashboard.
   */
  await page.goto("/");

  if (!page.url().includes("/onboarding")) return;

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expectBase(page).toHaveURL(`${WEB_URL}/`);
};

/**
 * Repeats `interact` until `settle` holds.
 *
 * The routes are server-rendered and then hydrated, so there is a window in
 * which a button exists, is visible, and does nothing at all: its React handler
 * is not attached yet. Playwright retries an action that fails, but a click that
 * lands on an un-hydrated button *succeeds* — it simply has no effect, and the
 * next assertion is what fails, fifteen seconds later.
 *
 * `toPass` retries the pair, so the click is repeated until the thing it was
 * supposed to cause has actually happened. It is a real condition rather than a
 * sleep, which is what keeps it deterministic.
 */
export const interactUntil = async (
  interact: () => Promise<void>,
  settle: () => Promise<void>,
  timeout = 20_000,
) =>
  expectBase(async () => {
    await interact();
    await settle();
  }).toPass({ timeout, intervals: [250, 500, 1000] });

/**
 * Fills and submits the contact form.
 *
 * `toBeEnabled()` is the wait for **hydration**, not for validation: the form
 * is server-rendered, and its button is disabled until React attaches because
 * until then pressing it does nothing. Waiting on that one signal is what makes
 * this deterministic — there is no sleeping and no retrying a fill, because the
 * inputs are uncontrolled and keep whatever was typed into them.
 */
export const addContact = async (page: Page, fullName: string, email: string) => {
  const submit = page.getByRole("button", { name: "Add contact" });

  await expectBase(submit).toBeEnabled();
  await page.getByLabel("Name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await submit.click();
};

export { expect } from "@playwright/test";
