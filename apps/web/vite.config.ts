import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import * as http from "node:http";
import * as path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** The prefixes `src/routes` forwards to the API — `src/server/proxy.ts`. */
const API_PREFIXES = ["/api/auth", "/api/files", "/rpc"];

/**
 * The same forwarding, done by the dev server before anything else sees the
 * request — so in development the browser still talks to one origin and the
 * session cookie is still first-party, as it is when deployed.
 *
 * Not the Start routes, which work and are what a build runs, because in
 * development Nitro relays every request body through its own proxy to a
 * worker, and a browser cancelling an in-flight POST — which Effect does to a
 * superseded RPC call as a matter of course — surfaces there as a server error
 * and paints Vite's overlay over the page. Not Vite's own `server.proxy`
 * either: Nitro's middleware is registered ahead of it and answers first. This
 * plugin is listed first, so its middleware is.
 *
 * Bytes are piped as they are, headers included — `X-Forwarded-For` above all,
 * which the rate limiter counts from the right — and a cancelled request
 * cancels the upstream one rather than being reported. `test/server/proxy.test.ts`
 * holds `proxy.ts` to the same contract.
 */
const apiDevProxy = (target: string): Plugin => ({
  name: "vantion:api-dev-proxy",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const url = request.url ?? "";
      const matches = API_PREFIXES.some((prefix) =>
        url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)
      );
      if (!matches) return next();

      const upstream = new URL(url, target);
      const forwarded = http.request(upstream, {
        method: request.method,
        headers: { ...request.headers, host: upstream.host },
      }, (answer) => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
      });

      forwarded.on("error", () => {
        if (!response.headersSent) response.statusCode = 502;
        response.end();
      });
      // The response, not the request: a request's `close` fires as soon as
      // its body has been read, and would cancel every call it forwarded.
      response.on("close", () => {
        if (!response.writableFinished) forwarded.destroy();
      });
      request.pipe(forwarded);
    });
  },
});

export default defineConfig(({ command, mode }) => {
  /**
   * Everything below is server-side. Nothing here reaches the browser — the app
   * has no client-side environment variables, and if it ever gains one it must
   * be `VITE_`-prefixed, which is the only way Vite exposes a value to the
   * client bundle.
   *
   * `loadEnv` reads the repo-root `.env`, the same file the API reads. Vite's
   * own loading looks inside this package and only surfaces `VITE_` values, so
   * it would find neither of the two below.
   */
  const env = loadEnv(mode, repoRoot, "");

  /**
   * This server's own address. The port comes from `WEB_URL` because the API
   * already needs that value for its trusted origins, and two variables that
   * must agree is one more than necessary.
   */
  const port = Number(
    new URL(process.env["WEB_URL"] ?? env["WEB_URL"] ?? "http://localhost:5173").port || 5173,
  );

  if (command === "serve") {
    /**
     * One variable the dev server needs in its own process, and only there.
     *
     * A deployment does not have this problem: `PORT` is whatever the platform
     * assigned that container. `bun run dev` is one shell and one `.env` for two
     * servers, so it is sorted out here instead.
     *
     * Nitro's plugin takes `PORT` as the dev server's port, and that variable
     * belongs to the API — so left alone both halves of `bun run dev` bind the same
     * one and whichever loses is invisible.
     */
    process.env["PORT"] = String(port);
  }

  return {
    plugins: [
      // First, so its middleware answers the API's prefixes before Nitro's.
      apiDevProxy(process.env["API_URL"] ?? env["API_URL"] ?? "http://localhost:3000"),
      // Must come before react(). It owns the route tree generation that the
      // standalone router plugin used to do, so there is only one of them.
      tanstackStart(),
      /**
       * Turns the Start build into a deployable server.
       *
       * Without it `vite build` emits a fetch handler and stops, and hosting is
       * the application's problem. Nitro wraps that handler and writes
       * `.output/server/index.mjs`, which `node` runs directly.
       */
      nitro(),
      tailwindcss(),
      react(),
    ],
    /**
     * Bundle the server build's dependencies, but only when building.
     *
     * Vite externalises them by default, which is wrong for an image — it means
     * shipping the dependency tree to run one bundle — and right for the dev
     * server, which is why this is conditional rather than always on. Inlining
     * them in dev puts React's CommonJS entry through Vite's ESM module runner,
     * and every server-rendered route dies on `module is not defined`.
     */
    /**
     * `@vantion/core` reads `process.env.VITE_AUTH_BASE_URL`, because the same
     * module is bundled by Metro for the Expo app and Metro has no
     * `import.meta.env`. Vite exposes its values on `import.meta.env` only, so
     * the one name the shared package reads is defined here.
     *
     * Normally empty: the browser uses its own origin, which forwards the API's
     * routes (`src/server/proxy.ts`). Set, it points browsers at an API on
     * another origin, substituted at build time like every other `VITE_` value.
     */
    define: {
      "process.env.VITE_AUTH_BASE_URL": JSON.stringify(
        process.env["VITE_AUTH_BASE_URL"] ?? env["VITE_AUTH_BASE_URL"] ?? "",
      ),
      "process.env.EXPO_PUBLIC_API_URL": JSON.stringify(""),
    },
    ssr: command === "build" ? { noExternal: true } : {},
    resolve: {
      /**
       * Source, not build output. The workspace packages expose `src` under a
       * `development` condition; Vite compiles TypeScript, so it wants that in
       * both dev and build rather than requiring the packages be built first.
       */
      conditions: ["development"],
      alias: {
        // Mirrors the `@/*` mapping in tsconfig.app.json and vitest.config.ts.
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      port,
      // Fail rather than quietly move if the port is taken; a web server on an
      // unexpected port looks exactly like the API being broken.
      strictPort: true,
    },
  };
});
