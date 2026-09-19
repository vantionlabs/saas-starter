import type { Browser, Page } from "@playwright/test";
import {
  addContact,
  completeOnboarding,
  expect,
  nextClientAddress,
  signOutViaApi,
  signUpViaApi,
  test,
  uniqueEmail,
} from "../fixtures.js";

/**
 * A signed-in page belonging to a brand-new organization, in a context of its
 * own so the two tenants never share a cookie jar.
 */
const newTenant = async (browser: Browser, prefix: string) => {
  // Its own forwarded address, for the same reason the default fixture sets one:
  // these contexts are extra callers and would otherwise share a rate-limit bucket.
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": nextClientAddress() },
  });
  const page = await context.newPage();
  const email = uniqueEmail(prefix);

  await signUpViaApi(page, email);
  /**
   * Past the setup wizard first. A fresh sign-up is redirected to it, so
   * without this the contacts page below is never reached and the isolation
   * assertions would pass against two empty wizards.
   */
  await completeOnboarding(page);
  await page.goto("/contacts");

  return { context, page, email };
};

/** The shared helper, plus the wait this file wants: the row is actually there. */
const addVisibleContact = async (page: Page, fullName: string, email: string) => {
  await addContact(page, fullName, email);
  await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();
};

/**
 * The isolation tests.
 *
 * Tenant separation is enforced twice here — Postgres row-level security on the
 * table, and `withOrgScope` around the query — on the stated principle that
 * neither is trusted alone. Unit tests cover each mechanism; what they cannot
 * show is that the whole stack, session to SQL, actually keeps two real users
 * apart. That is this file's only job, and it is the most valuable thing in the
 * suite: every other bug is a bug, and this one is a breach.
 */
test.describe("tenant isolation", () => {
  test("one organization cannot see another's contacts", async ({ browser }) => {
    const alice = await newTenant(browser, "alice");
    const bob = await newTenant(browser, "bob");

    const aliceContact = uniqueEmail("alice-contact");
    const bobContact = uniqueEmail("bob-contact");

    await addVisibleContact(alice.page, "Alice's Contact", aliceContact);
    await addVisibleContact(bob.page, "Bob's Contact", bobContact);

    // Each sees exactly their own, and the negative assertion is the point.
    await expect(alice.page.getByRole("row").filter({ hasText: aliceContact })).toBeVisible();
    await expect(alice.page.getByRole("row").filter({ hasText: bobContact })).toHaveCount(0);

    await bob.page.reload();
    await expect(bob.page.getByRole("row").filter({ hasText: bobContact })).toBeVisible();
    await expect(bob.page.getByRole("row").filter({ hasText: aliceContact })).toHaveCount(0);

    await alice.context.close();
    await bob.context.close();
  });

  test("a fresh organization starts empty however many others exist", async ({ browser }) => {
    const first = await newTenant(browser, "incumbent");
    await addVisibleContact(first.page, "Existing Person", uniqueEmail("existing"));

    const second = await newTenant(browser, "newcomer");

    // Not merely "does not contain the other's row" — genuinely empty, which is
    // what a leaking `where` clause would quietly break.
    await expect(second.page.getByText("No contacts yet")).toBeVisible();
    await expect(second.page.getByRole("table")).toBeHidden();

    await first.context.close();
    await second.context.close();
  });

  test("signing out revokes access to the data immediately", async ({ browser }) => {
    const tenant = await newTenant(browser, "revoked");
    const contact = uniqueEmail("revoked-contact");
    await addVisibleContact(tenant.page, "Soon Invisible", contact);

    await signOutViaApi(tenant.page);
    await tenant.page.goto("/contacts");

    await expect(tenant.page).toHaveURL(/\/auth\/sign-in/);
    await expect(tenant.page.getByText(contact)).toHaveCount(0);

    await tenant.context.close();
  });
});
