import { makeAuth } from "@/auth/Options.js";
import { testDbUrl } from "@vantion/database/PgTest";
import * as Pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const ORIGIN = "http://localhost:5173";

/**
 * Its own pool rather than `PgPoolTest`, which is scoped: acquiring it outside
 * an Effect scope closes it the moment the scope ends, and every request then
 * fails with a 500 that says nothing about why.
 */
const pool = new Pg.Pool({
  connectionString: testDbUrl() ?? "postgresql://localhost/unused",
  application_name: "vantion-sso-test",
});

pool.on("error", () => {});

afterAll(async () => {
  await pool.end().catch(() => {});
});

/**
 * The same composition the server builds, with one function replaced.
 *
 * `ssoEntitled` is the seam under test: it is the only thing better-auth cannot
 * answer for itself, because a plan lives in a table its plugin has never heard
 * of.
 */
const authFor = (entitled: boolean) =>
  makeAuth({
    pool,
    product: "vantion",
    webUrl: ORIGIN,
    seatsFor: async () => 3,
    ssoEntitled: async () => entitled,
    baseURL: "http://localhost:3000",
    secret: "test-secret-that-is-long-enough-for-hmac",
    trustedOrigins: [ORIGIN],
    google: undefined,
    cookieDomain: undefined,
    sendEmail: async () => {},
  });

/**
 * better-auth refuses a request with no `Content-Type` (415) and one with no
 * `Origin` (403), so every call here sends both. That is not ceremony: those
 * two refusals are the first thing an integration against it runs into.
 */
const post = (
  auth: ReturnType<typeof authFor>,
  path: string,
  body: unknown,
  cookie?: string,
) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...(cookie === undefined ? {} : { cookie }),
      },
      body: JSON.stringify(body),
    }),
  );

/** Signs up a user, and returns the session cookie and their organization. */
const signUp = async (auth: ReturnType<typeof authFor>, tag: string) => {
  const email = `sso-${tag}-${Date.now()}@example.com`;

  const response = await post(auth, "/sign-up/email", {
    email,
    password: "correct horse battery staple",
    name: "SSO Tester",
  });

  expect(response.status, await response.clone().text()).toBe(200);

  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");

  const { rows } = await pool.query<{ id: string; }>(
    `select o."id" from "organization" o
       join "member" m on m."organizationId" = o."id"
       join "user" u on u."id" = m."userId"
      where u."email" = $1`,
    [email],
  );

  const organizationId = rows[0]?.id;
  expect(organizationId).toBeDefined();

  return { cookie, organizationId: organizationId!, email };
};

/**
 * A provider with `skipDiscovery`, which is what the product uses.
 *
 * Discovery fetches a URL the registrant supplied, so better-auth requires its
 * origin to be in `trustedOrigins` — which would make adding a customer's
 * identity provider a deployment rather than a row. Explicit endpoints need
 * only be publicly routable, and registering makes no network call at all.
 */
const provider = (tag: string, organizationId: string) => ({
  issuer: "https://idp.example.com",
  domain: `${tag}.example.com`,
  providerId: `sso-${tag}`,
  organizationId,
  oidcConfig: {
    issuer: "https://idp.example.com",
    clientId: "client",
    clientSecret: "secret",
    skipDiscovery: true,
    authorizationEndpoint: "https://idp.example.com/authorize",
    tokenEndpoint: "https://idp.example.com/token",
    jwksEndpoint: "https://idp.example.com/jwks",
    scopes: ["openid", "email", "profile"],
  },
});

describe.skipIf(testDbUrl() === undefined)("single sign-on", () => {
  /**
   * The registration endpoint is better-auth's, so this is the only place the
   * plan can be enforced. A check in one of our own handlers would be one a
   * request straight to `/api/auth/sso/register` walks past — which is the
   * whole reason it is a `before` hook rather than a policy.
   */
  it("refuses to register a provider for an organization whose plan lacks it", async () => {
    const auth = authFor(false);
    const { cookie, organizationId } = await signUp(auth, "unentitled");

    const response = await post(
      auth,
      "/sso/register",
      provider(`unentitled-${Date.now()}`, organizationId),
      cookie,
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("does not include single sign-on");
  });

  /**
   * The gate is specific rather than a blanket refusal. Asserting only the
   * failure above would pass just as well against a hook that rejected
   * everything, which is a test of nothing.
   */
  it("registers one for an organization whose plan carries it", async () => {
    const auth = authFor(true);
    const tag = `entitled-${Date.now()}`;
    const { cookie, organizationId } = await signUp(auth, "entitled");

    const response = await post(auth, "/sso/register", provider(tag, organizationId), cookie);

    expect(response.status, await response.clone().text()).toBe(200);

    const { rows } = await pool.query<{ organizationId: string; domainVerified: boolean | null; }>(
      `select "organizationId", "domainVerified" from "ssoProvider" where "providerId" = $1`,
      [`sso-${tag}`],
    );

    expect(rows[0]?.organizationId).toBe(organizationId);

    /**
     * Registered but not yet usable. `domainVerification` is enabled, so a
     * provider only routes sign-ins once DNS proves the domain — without that,
     * anybody who may register a provider can claim any company's domain and
     * become the identity provider for everyone whose address ends that way.
     */
    expect(rows[0]?.domainVerified ?? false).toBe(false);
  });

  /**
   * Isolation on a table with no row-level security policy.
   *
   * `ssoProvider` is written by better-auth outside any `withOrgScope`
   * transaction, so it carries no policy — `0011_sso.sql` says why at length.
   * What stands in its place is the plugin's own membership check, and this is
   * the test that it actually holds.
   */
  it("refuses a provider for an organization the caller does not belong to", async () => {
    const auth = authFor(true);
    const theirs = await signUp(auth, "victim");
    const mine = await signUp(auth, "attacker");

    const response = await post(
      auth,
      "/sso/register",
      provider(`stolen-${Date.now()}`, theirs.organizationId),
      mine.cookie,
    );

    expect(response.status).not.toBe(200);
    expect(await response.text()).toContain("not a member of the organization");
  });
});
