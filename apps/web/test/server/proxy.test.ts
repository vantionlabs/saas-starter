// @vitest-environment node
import { forward } from "@/server/proxy.js";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

interface Seen {
  readonly method: string;
  readonly path: string;
  readonly body: string;
  readonly headers: http.IncomingHttpHeaders;
}

/**
 * A real HTTP server standing in for the API, recording what arrived. The
 * proxy's job is what crosses the wire, so a stubbed `fetch` would test the
 * wrong thing.
 */
let server: http.Server;
let seen: Array<Seen> = [];

beforeAll(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      seen.push({
        method: request.method ?? "",
        path: request.url ?? "",
        body,
        headers: request.headers,
      });

      if (request.url?.startsWith("/api/auth/callback")) {
        response.writeHead(302, { location: "http://localhost:5173/" });
        response.end();
        return;
      }

      const payload = zlib.gzipSync(JSON.stringify({ ok: true }));
      response.writeHead(200, {
        "content-type": "application/json",
        "content-encoding": "gzip",
        "set-cookie": ["session=abc; Path=/; HttpOnly", "csrf=def; Path=/"],
      });
      response.end(payload);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env["API_URL"] = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  delete process.env["API_URL"];
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const request = (path: string, init?: RequestInit) => {
  seen = [];
  return forward(new Request(`http://localhost:5173${path}`, init));
};

/**
 * `src/server/proxy.ts` is what a built web server runs to put the API behind
 * this origin. The browser suite exercises the same prefixes through Vite's dev
 * proxy, so the contract is held here, against the function itself.
 */
describe("forwarding to the API", () => {
  it("keeps the path, query, method and body", async () => {
    await request("/api/files/org/abc?expires=1&signature=s", {
      method: "PUT",
      body: "hello world file body",
      headers: { "content-type": "text/plain" },
    });

    expect(seen[0]).toMatchObject({
      method: "PUT",
      path: "/api/files/org/abc?expires=1&signature=s",
      body: "hello world file body",
    });
  });

  /**
   * The rate limiter counts the rightmost entry, which Railway's edge wrote.
   * Appending this server's view would make every caller the same caller.
   */
  it("passes X-Forwarded-For through untouched", async () => {
    await request("/api/auth/sign-in/email", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.9, 198.51.100.7" },
    });

    expect(seen[0]?.headers["x-forwarded-for"]).toBe("10.0.0.9, 198.51.100.7");
  });

  it("sends the cookie and origin, and not this server's host", async () => {
    await request("/rpc", {
      method: "POST",
      body: "[]",
      headers: { cookie: "session=abc", origin: "http://localhost:5173", host: "localhost:5173" },
    });

    expect(seen[0]?.headers["cookie"]).toBe("session=abc");
    expect(seen[0]?.headers["origin"]).toBe("http://localhost:5173");
    expect(seen[0]?.headers["host"]).not.toBe("localhost:5173");
  });

  it("returns every cookie the API sets, for this origin to keep", async () => {
    const response = await request("/api/auth/get-session");

    expect(response.headers.getSetCookie()).toEqual([
      "session=abc; Path=/; HttpOnly",
      "csrf=def; Path=/",
    ]);
  });

  /** `fetch` already decoded it; a header still saying gzip makes the browser try again. */
  it("does not claim an encoding the body no longer has", async () => {
    const response = await request("/api/auth/get-session");

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
  });

  /** An OAuth callback's redirect belongs to the browser, cookies and all. */
  it("hands redirects back rather than following them", async () => {
    const response = await request("/api/auth/callback/google?code=x");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:5173/");
  });
});
