import { defineRailway, github, postgres, preserve, project, redis, service } from "railway/iac";

/**
 * The whole Railway project, in one file.
 *
 * `railway config plan` shows the diff against the linked environment and
 * `railway config apply` performs it, so a deployment is reviewable the way a
 * pull request is rather than assembled by clicking.
 *
 * Three things to change on a fork: the repository below, the domain each
 * environment answers on, and the project name at the bottom.
 *
 * Note that Railway's IaC API is in beta and its own README says it will change.
 * The stable alternative is a `railway.json` per app, which covers build and
 * deploy settings but cannot create the database or the services — which is most
 * of what makes this worth having.
 */

/**
 * The repository both services build from.
 *
 * A constant rather than something read from the environment, and deliberately:
 * `railway config plan` is only worth trusting because the committed file *is*
 * the desired state. `process.env` is readable here — the runner passes the
 * shell straight through — but a plan that depends on it stops being
 * reproducible, and a CI drift check has nothing fixed to compare against. This
 * changes once, when you fork.
 *
 * Nor is it worth hiding. A repository path is not a secret: it is already in
 * your git remote, and Railway will not read it without the GitHub
 * authorization the connection grants. `preserve()` below is for the values
 * that genuinely are secret.
 */
const REPO = "vantionlabs/saas-starter";

interface Target {
  /** Must be a branch that actually carries this code — both services build from it. */
  readonly branch: string;
  /**
   * The parent domain the two services sit under, or `undefined` to leave
   * domains to the dashboard.
   *
   * Railway does not give a new service a public domain on its own, and this
   * file cannot ask for one: the runner rejects a `domains` entry outright with
   * "Custom-domain registration is not supported by Railway configuration". So
   * domains are added in the dashboard either way, and what this decides is
   * whether the variables below *name* them or fall back to
   * `RAILWAY_PUBLIC_DOMAIN`.
   *
   * That fallback is not a working deployment. Until a domain exists for each
   * service the reference resolves against nothing, so `WEB_URL` and the rest
   * become a bare `https://` — the API trusts no origin and the client has no
   * API to call. Name a domain you have pointed at Railway and the addresses
   * are settled before the first deploy instead.
   *
   * It also settles the cookie question rather than deferring it. The browser
   * sends the session cookie between two origins only if it considers them
   * same-site, which needs both under one parent and `AUTH_COOKIE_DOMAIN`
   * scoped to it. `up.railway.app` is a public suffix, so two generated hosts
   * can never qualify however they are configured — a split deployment needs a
   * domain of your own, and this is where you say so.
   */
  readonly domain: string | undefined;
}

/**
 * What each Railway environment deploys, and where it answers.
 *
 * This is the axis that genuinely varies, so it is the one thing here that is
 * resolved at plan time — from `ctx.isEnvironment`, which the runner derives
 * from the environment being planned against, not from the shell. Two people
 * planning the same environment still get the same plan.
 */
const environments = {
  production: { branch: "main", domain: undefined },
  staging: { branch: "staging", domain: undefined },
} as const satisfies Record<string, Target>;

/**
 * Railway resolves `${{NAME}}` against the service the variable belongs to and
 * `${{other.NAME}}` against a sibling, so a generated domain has two spellings
 * depending on who is asking. A real domain has one, and we know it up front.
 */
const host = (name: string, subdomain: string, domain: string | undefined) => ({
  own: domain === undefined ? "${{RAILWAY_PUBLIC_DOMAIN}}" : `${subdomain}.${domain}`,
  fromSibling: domain === undefined
    ? `\${{${name}.RAILWAY_PUBLIC_DOMAIN}}`
    : `${subdomain}.${domain}`,
});

/** Everything the API needs that is not a secret and not a reference. */
const shared = {
  DATABASE_SSL: "true",
  EMAIL_FROM: "vantion@example.com",
  /**
   * Railway's edge terminates the connection and forwards, so exactly one proxy
   * stands in front of the container and appends the caller's real address to
   * `X-Forwarded-For`. Leaving this unset would key every auth rate limit on
   * that edge instead, putting the whole internet in one bucket; setting it
   * higher than the truth would let a caller forge the entry that is counted.
   */
  TRUST_PROXY: "1",
} as const;

export default defineRailway((ctx) => {
  const target: Target = ctx.isEnvironment("staging")
    ? environments.staging
    : environments.production;

  const apiHost = host("api", "api", target.domain);
  const webHost = host("web", "app", target.domain);

  const db = postgres("postgres");

  /**
   * The queue BullMQ runs on.
   *
   * Without it the worker still works — the in-memory queue takes over and the
   * outbox is still transactional — but nothing survives a restart, which is
   * fine on a laptop and not in production.
   */
  const cache = redis("redis");

  const api = service("api", {
    source: github(REPO, { branch: target.branch }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/server/Dockerfile",
      /**
       * A change to the front end should not rebuild the API. The shared
       * packages are listed because a change to either genuinely does.
       */
      watchPatterns: [
        "apps/server/**",
        "packages/database/**",
        "packages/domain/**",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ],
    },
    deploy: {
      /**
       * Migrations run before the new release takes traffic, and only once —
       * which is the whole reason they are a script rather than something the
       * server does at boot, where two starting instances would both migrate.
       */
      preDeployCommand: ["node packages/database/build/bundle/migrate.js"],
      healthcheckPath: "/health",
      healthcheckTimeout: 30,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    env: {
      ...shared,
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      /**
       * Its own public URL. better-auth builds callback and magic-link URLs
       * from this, so it has to be what a browser actually reached.
       */
      AUTH_BASE_URL: `https://${apiHost.own}`,
      /**
       * The web service's public URL, and load-bearing rather than cosmetic:
       * `Auth.ts` passes it to better-auth as a trusted origin, and a browser
       * POST from an origin that is not on that list is refused outright.
       */
      WEB_URL: `https://${webHost.fromSibling}`,
      /**
       * The parent both services sit under, so the session cookie is same-site
       * between them. Required once they are separate origins, and impossible
       * on Railway's generated hosts — `up.railway.app` is a public suffix, so
       * a cookie can never be scoped across two of them.
       */
      AUTH_COOKIE_DOMAIN: target.domain === undefined ? preserve() : `.${target.domain}`,
      /**
       * Secrets are Railway's, not source control's. `preserve()` keeps
       * whatever is already set rather than planning a change to it — so
       * generate AUTH_SECRET once in the dashboard and this file leaves it be.
       */
      AUTH_SECRET: preserve(),
      RESEND_API_KEY: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      OTEL_EXPORTER_OTLP_ENDPOINT: preserve(),
      OTEL_EXPORTER_OTLP_HEADERS: preserve(),
      SENTRY_DSN: preserve(),
      SENTRY_ENVIRONMENT: preserve(),
    },
  });

  /**
   * The outbox relay and the jobs it feeds.
   *
   * No domain and no health check: it serves nothing, so there is nothing to
   * probe. It is the part of the system most likely to fail quietly — nobody is
   * watching a response while a webhook is delivered — which is why it carries
   * the same telemetry and error-tracking variables the API does.
   *
   * It does not run migrations. The API's `preDeployCommand` does that, and two
   * services migrating the same database is the race that command exists to
   * avoid.
   */
  const worker = service("worker", {
    source: github(REPO, { branch: target.branch }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/worker/Dockerfile",
      watchPatterns: [
        "apps/worker/**",
        "packages/database/**",
        "packages/modules/jobs/**",
        "packages/modules/webhooks/**",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ],
    },
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    env: {
      ...shared,
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      OTEL_EXPORTER_OTLP_ENDPOINT: preserve(),
      OTEL_EXPORTER_OTLP_HEADERS: preserve(),
      SENTRY_DSN: preserve(),
      SENTRY_ENVIRONMENT: preserve(),
      S3_BUCKET: preserve(),
      S3_REGION: preserve(),
      S3_ENDPOINT: preserve(),
      S3_ACCESS_KEY_ID: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
      OPENROUTER_API_KEY: preserve(),
      ASSISTANT_MODEL: preserve(),
      ASSISTANT_MODEL_ID: preserve(),
    },
  });

  const web = service("web", {
    source: github(REPO, { branch: target.branch }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
      watchPatterns: [
        "apps/web/**",
        "packages/domain/**",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ],
    },
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    env: {
      /**
       * The API's *public* address, because a browser resolves it — the client
       * bundle talks to the API directly rather than through this server.
       *
       * Vite bakes `VITE_` values in at build time, so this must also be set as
       * a build argument for the image; as a runtime variable alone it does
       * nothing. On Railway that means a custom domain, since two generated
       * `*.up.railway.app` hosts cannot share a session cookie.
       */
      VITE_AUTH_BASE_URL: `https://${apiHost.fromSibling}`,
      WEB_URL: `https://${webHost.own}`,
    },
  });

  /**
   * The marketing site, on its own host.
   *
   * Static files behind nginx, so it has no variables, no database and no
   * health check worth writing — if the container is up, the page is there.
   * Its own service rather than a route on the web app because a landing page
   * and a product should be able to fail independently: a deploy that breaks
   * the app should not take the page that explains it down too.
   */
  const marketing = service("marketing", {
    source: github(REPO, { branch: target.branch }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/marketing/Dockerfile",
      watchPatterns: [
        "apps/marketing/**",
        "packages/ui/**",
        "packages/tokens/**",
        "packages/modules/iam/**",
        "pnpm-lock.yaml",
      ],
    },
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    env: {},
  });

  /** The brand kit, the same way: files behind nginx, on a host of its own. */
  const brand = service("brand", {
    source: github(REPO, { branch: target.branch }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/brand/Dockerfile",
      watchPatterns: [
        "apps/brand/**",
        "packages/ui/**",
        "packages/tokens/**",
        "packages/emails/**",
        "pnpm-lock.yaml",
      ],
    },
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    env: {},
  });

  return project("vantion", {
    resources: [db, cache, api, worker, web, marketing, brand],
  });
});
