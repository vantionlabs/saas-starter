import { makeAuth } from "@/auth/Options.js";
import { testDbUrl } from "@vantion/database/PgTest";
import * as Pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const ORIGIN = "http://localhost:5173";

/** Its own pool, for the reason `Sso.test.ts` gives: `PgPoolTest` is scoped. */
const pool = new Pg.Pool({
  connectionString: testDbUrl() ?? "postgresql://localhost/unused",
  application_name: "vantion-scim-test",
});

pool.on("error", () => {});

afterAll(async () => {
  await pool.end().catch(() => {});
});

/**
 * The same composition the server builds, with the three seams this file is
 * about replaced: whether the plan carries provisioning, and whether there is a
 * seat left. Neither is something better-auth can answer — one lives in a table
 * its plugin has never heard of, and the other is a limit its SCIM endpoints
 * do not consult at all.
 */
const authFor = (options: { readonly entitled: boolean; readonly seats: boolean; }) =>
  makeAuth({
    pool,
    product: "vantion",
    webUrl: ORIGIN,
    seatsFor: async () => 3,
    ssoEntitled: async () => true,
    scimEntitled: async () => options.entitled,
    seatAvailableFor: async () => options.seats,
    baseURL: "http://localhost:3000",
    secret: "test-secret-that-is-long-enough-for-hmac",
    trustedOrigins: [ORIGIN],
    google: undefined,
    cookieDomain: undefined,
    sendEmail: async () => {},
  });

type Auth = ReturnType<typeof authFor>;

const post = (auth: Auth, path: string, body: unknown, headers: Record<string, string> = {}) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );

const signUp = async (auth: Auth, tag: string) => {
  const email = `scim-${tag}-${Date.now()}@example.com`;

  const response = await post(auth, "/sign-up/email", {
    email,
    password: "correct horse battery staple",
    name: "SCIM Tester",
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

const generateToken = async (auth: Auth, tag: string, entitled = true) => {
  const { cookie, organizationId } = await signUp(auth, tag);

  const response = await post(
    auth,
    "/scim/generate-token",
    { providerId: `scim-${tag}-${Date.now()}`, organizationId },
    { cookie },
  );

  if (!entitled) return { response, organizationId, cookie, token: undefined };

  // 201, because issuing a token creates a provider connection.
  expect(response.status, await response.clone().text()).toBe(201);

  const { scimToken } = await response.clone().json() as { scimToken: string; };

  return { response, organizationId, cookie, token: scimToken };
};

const provision = (auth: Auth, token: string, userName: string) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/scim/v2/Users", {
      method: "POST",
      headers: {
        "content-type": "application/scim+json",
        origin: ORIGIN,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName,
        active: true,
        emails: [{ value: userName, primary: true }],
      }),
    }),
  );

describe.skipIf(testDbUrl() === undefined)("directory provisioning", () => {
  /**
   * The plan gate, on better-auth's own endpoint. A check anywhere else is one
   * a request straight to `/api/auth/scim/generate-token` walks past — the same
   * lesson `/sso/register` taught, and the reason both are `before` hooks.
   */
  it("refuses a token to an organization whose plan lacks provisioning", async () => {
    const auth = authFor({ entitled: false, seats: true });
    const { response } = await generateToken(auth, "unentitled", false);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("directory provisioning");
  });

  it("issues one to an organization that has it", async () => {
    const auth = authFor({ entitled: true, seats: true });
    const { token } = await generateToken(auth, "entitled");

    expect(token).toBeTruthy();
  });

  /**
   * **The token is stored hashed.** The plugin's default is `plain`, which
   * would leave a credential able to create and disable users across an
   * organization readable in the database. This asserts the column does not
   * contain what was handed out.
   */
  it("keeps no readable copy of the token it issued", async () => {
    const auth = authFor({ entitled: true, seats: true });
    const { token, organizationId } = await generateToken(auth, "hashed");

    const { rows } = await pool.query<{ scimToken: string; }>(
      `select "scimToken" from "scimProvider" where "organizationId" = $1`,
      [organizationId],
    );

    expect(rows[0]?.scimToken).toBeDefined();
    expect(token).toBeTruthy();
    expect(rows[0]?.scimToken).not.toBe(token);
    // Nor the inner half of it, which is what the bearer header is built from.
    expect(token).not.toContain(rows[0]!.scimToken);
  });

  /**
   * **Personal tokens do not exist here.** The plugin allows an
   * organization-less token to any authenticated user, and a SCIM token can
   * provision and disable people — in a B2B product there is no personal
   * directory for one to belong to.
   */
  it("refuses a token that belongs to no organization", async () => {
    const auth = authFor({ entitled: true, seats: true });
    const { cookie } = await signUp(auth, "personal");

    const response = await post(
      auth,
      "/scim/generate-token",
      { providerId: `scim-personal-${Date.now()}` },
      { cookie },
    );

    expect(response.status).not.toBe(200);
  });

  /** A stranger cannot ask for one at all. */
  it("refuses a token to somebody with no session", async () => {
    const auth = authFor({ entitled: true, seats: true });

    const response = await post(auth, "/scim/generate-token", {
      providerId: `scim-anon-${Date.now()}`,
      organizationId: "org_does_not_exist",
    });

    expect(response.status).not.toBe(200);
  });

  it("provisions a user into the token's organization", async () => {
    const auth = authFor({ entitled: true, seats: true });
    const { token, organizationId } = await generateToken(auth, "provision");
    const userName = `provisioned-${Date.now()}@acme.example`;

    const response = await provision(auth, token!, userName);

    expect(response.status, await response.clone().text()).toBe(201);

    const { rows } = await pool.query<{ count: string; }>(
      `select count(*)::text as count from "member" m
         join "user" u on u."id" = m."userId"
        where m."organizationId" = $1 and u."email" = $2`,
      [organizationId, userName],
    );

    expect(rows[0]?.count).toBe("1");
  });

  /**
   * **The gap this slice closes.** `membershipLimit` guards better-auth's
   * invitation endpoints, and SCIM does not go through them — it inserts a
   * `member` row through the adapter directly. Without the hook, a directory
   * of five hundred people fills an organization sold three seats and nothing
   * says no: revenue, and the easiest way to grow this database from outside.
   */
  it("refuses to provision past the plan's seats", async () => {
    const auth = authFor({ entitled: true, seats: false });
    const { token } = await generateToken(auth, "full");

    const response = await provision(auth, token!, `overflow-${Date.now()}@acme.example`);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("seats");
  });

  /**
   * The ordering question the seat hook raises, answered rather than assumed.
   *
   * The hook reads the organization out of the bearer token *before* the
   * plugin has verified it, so a forged token naming a full organization could
   * in principle be refused with "no seats left" — telling an unauthenticated
   * caller something about a tenant. This pins which answer comes back.
   */
  it("still refuses a forged token when the organization is full", async () => {
    const auth = authFor({ entitled: true, seats: false });
    const forged = Buffer.from("nottherealtoken:scim-forged:org_x").toString("base64url");

    const response = await provision(auth, forged, `forged-full-${Date.now()}@acme.example`);

    expect(response.status).toBe(401);
  });

  /** And the credential is still the credential: a wrong one provisions nothing. */
  it("refuses a forged token", async () => {
    const auth = authFor({ entitled: true, seats: true });
    const forged = Buffer.from("nottherealtoken:scim-forged:org_x").toString("base64url");

    const response = await provision(auth, forged, `forged-${Date.now()}@acme.example`);

    expect(response.status).toBe(401);
  });
});
