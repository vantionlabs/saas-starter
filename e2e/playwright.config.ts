import { defineConfig, devices } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

/**
 * Ports of their own, deliberately not 3000 and 5173.
 *
 * `pnpm dev` is usually already running when someone reaches for these tests,
 * and `strictPort` in the web app's Vite config means a collision is a hard
 * failure rather than a quiet move to another port.
 */
const API_PORT = 3100;
const WEB_PORT = 5273;

const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

/**
 * The database `prepare-db.mjs` started for this run.
 *
 * Its port is chosen at run time, so it arrives through a file rather than the
 * environment — a child process cannot export a value back to its parent, and
 * this config is loaded by a third process again.
 */
const readDatabaseUrl = () => {
  const file = path.join(import.meta.dirname, ".e2e-env.json");

  if (!fs.existsSync(file)) {
    throw new Error(
      "no e2e database recorded — run `pnpm --filter @vantion/e2e test`, which prepares one,\n"
        + "rather than invoking `playwright test` directly.",
    );
  }

  return JSON.parse(fs.readFileSync(file, "utf8")).url as string;
};

const DATABASE_URL = readDatabaseUrl();

/**
 * The environment both servers run under.
 *
 * `RESEND_API_KEY` is deliberately absent: without it the mailer writes each
 * message to the server log instead of sending it, which is what lets the auth
 * flows be exercised without a mail account or a network round trip.
 */
const serverEnv = {
  ...process.env,
  DATABASE_URL,
  DATABASE_SSL: "false",
  AUTH_SECRET: "e2e-secret-not-for-any-real-deployment-0000000000",
  AUTH_BASE_URL: API_URL,
  WEB_URL,
  VITE_AUTH_BASE_URL: API_URL,
  PORT: String(API_PORT),
  /**
   * Nothing stands in front of the API here, but the suite presents a distinct
   * `X-Forwarded-For` per test so each gets its own rate-limit bucket. Declaring
   * one trusted hop is what makes the server read that header — and it is the
   * honest setting, because Playwright is the one hop appending it.
   */
  TRUST_PROXY: "1",
  // An exporter pointed at nothing retries on a schedule and floods the output.
  OTEL_EXPORTER_OTLP_ENDPOINT: "",
  /**
   * No S3 credentials, so uploads go to the local store and the API serves them
   * from here. That is the configuration a fresh clone runs in, which makes it
   * the one worth having the browser exercise — and it means the upload test
   * needs no bucket.
   */
  FILES_DIR: path.join(import.meta.dirname, "test-results", "uploads"),
  /**
   * The deterministic stand-in, asked for explicitly.
   *
   * What the browser suite is for here is the loop and the gate — a tool runs,
   * a write stops to ask, a person answers — none of which a real model would
   * prove more truthfully. It would only make the run non-deterministic, slow
   * and chargeable.
   */
  ASSISTANT_MODEL: "scripted",
};

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  /**
   * Every test signs up its own user with a unique address, so no two tests
   * share a tenant and they can run in parallel against one database.
   */
  fullyParallel: true,

  // A `.only` left in a file passes locally and silently narrows CI.
  forbidOnly: process.env["CI"] !== undefined,
  retries: process.env["CI"] !== undefined ? 2 : 0,

  /**
   * Capped rather than left to the default of half the cores.
   *
   * These run against `vite dev` and `tsx watch`, not a build: the servers
   * compile on demand, and enough concurrent first-hits leaves a route still
   * loading when the assertion times out. The failure then reads as a missing
   * element rather than as a slow one, which is a bad hour for whoever meets it
   * first.
   */
  workers: process.env["CI"] !== undefined ? 2 : 4,

  reporter: process.env["CI"] !== undefined
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  /**
   * Longer than the 5s default, for the same reason the worker count is capped:
   * a dev server's first render of a route includes compiling it.
   */
  expect: { timeout: 15_000 },

  use: {
    baseURL: WEB_URL,
    // Kept only for failures: a trace per test is slow and mostly noise, and
    // the first retry is where the evidence is actually wanted.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  /**
   * Both halves of the app, started the way `pnpm dev` starts them.
   *
   * `reuseExistingServer` is off even locally: these run on their own ports
   * against their own database, so a server already listening there is a stale
   * one from an interrupted run, not something worth reusing.
   */
  webServer: [
    {
      command: "pnpm --filter @vantion/server dev",
      cwd: ROOT,
      url: `${API_URL}/health`,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @vantion/web dev",
      cwd: ROOT,
      url: WEB_URL,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

export { API_URL, WEB_URL };
