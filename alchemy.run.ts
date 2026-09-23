/**
 * The whole Railway deployment, in one file: a Project per stage, its Postgres
 * and Redis, and the five services built from this repository's Dockerfiles.
 *
 *   bun run deploy:plan --stage staging     what would change
 *   bun run deploy --stage staging          change it
 *   bun run deploy:destroy --stage staging  remove all of it, database included
 *
 * A stage is a Project, not an environment inside one. Staging and production
 * then share nothing — no variables, no private network, no volume — and
 * `destroy` on one cannot reach the other. It also means a stage that is not in
 * `targets` below is refused rather than created: `alchemy deploy` with no
 * `--stage` defaults to `live_$USER`, and a Project per person deploying `main`
 * is a bill nobody asked for.
 *
 * State lives in a Postgres of its own (`ALCHEMY_STATE_DATABASE_URL`), outside
 * every Project this file creates. Kept inside one, `destroy` would delete the
 * record of what it was destroying halfway through doing it.
 *
 * Secrets are read from the environment at deploy time — GitHub environment
 * secrets in CI, `.env` locally — and written to Railway as service variables.
 * That is a change from `railway config apply`, which left them alone: here the
 * deploying environment is the source of truth, and a value set by hand in the
 * dashboard is overwritten by the next deploy.
 */
import * as Alchemy from "alchemy";
/**
 * By file, not through `alchemy/Railway`: that barrel also exports the framework
 * Website composites, which import an optional peer this repository has no use
 * for and bun's isolated linker rightly does not install.
 */
import { CustomDomain } from "alchemy/Railway/CustomDomain";
import { Postgres } from "alchemy/Railway/Postgres";
import { Project } from "alchemy/Railway/Project";
import { providers } from "alchemy/Railway/Providers";
import { Redis } from "alchemy/Railway/Redis";
import { ref } from "alchemy/Railway/ref";
import { Service } from "alchemy/Railway/Service";
import { postgresState } from "alchemy/State/PostgresState";
import { Config, Effect, Option, Schema } from "effect";
import { requiredManifestDirs } from "./tooling/DockerManifests.ts";

/**
 * Deployed from, not read from. A fork changes this and nothing else to point
 * the services at its own repository; Railway needs a GitHub connection to it.
 */
const REPO = "vantionlabs/saas-starter";

/**
 * The stages that exist, and what each deploys.
 *
 * `domain` is the parent of `app.` and `api.` once the stage has one, and
 * setting it creates both hostnames. Until then both services use their
 * generated `*.up.railway.app` hosts, which is enough to boot but not to sign
 * in: `up.railway.app` is a public suffix, so no cookie can span the two.
 * `docs/deploy.md` has the long version.
 */
const targets = {
  prod: { branch: "main", domain: undefined },
  staging: { branch: "staging", domain: undefined },
} as const satisfies Record<
  string,
  { readonly branch: string; readonly domain: string | undefined; }
>;

class UnknownStage extends Schema.TaggedError<UnknownStage>()("UnknownStage", {
  stage: Schema.String,
  known: Schema.Array(Schema.String),
}) {
  override get message() {
    return `No target for stage "${this.stage}". Deploy one of: ${this.known.join(", ")}.`;
  }
}

/**
 * A service's own host, and a sibling's, as Railway spells them.
 *
 * The template is resolved by Railway at deploy time, by *service name* — which
 * is why every service below sets `name` to its logical id.
 */
const hostOf = (service: string, subdomain: string, domain: string | undefined) => ({
  own: domain === undefined ? "${{RAILWAY_PUBLIC_DOMAIN}}" : `${subdomain}.${domain}`,
  fromSibling: domain === undefined
    ? ref(service, "RAILWAY_PUBLIC_DOMAIN")
    : `${subdomain}.${domain}`,
});

/**
 * What triggers a rebuild: every workspace package the image installs, plus
 * the two root files that change what gets installed.
 *
 * Derived from the Dockerfile rather than listed, by the same function
 * `tooling/test/docker.test.ts` holds the `COPY` lines to. The lists this
 * replaced had drifted to three directories for an image that depends on
 * eighteen, so a change to any module shipped whenever something else did.
 */
const watching = (app: string) => [
  ...requiredManifestDirs(import.meta.dirname, app).map((dir) => `${dir}/**`),
  "package.json",
  "bun.lock",
];

/** Everything a stage needs that is not a secret and not a reference. */
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

/** A secret the stage cannot run without. */
const required = (name: string) => Config.Redacted(name);

/**
 * A secret the stage runs without, as `undefined` when it is unset — which is
 * what a service's `env` drops rather than writing an empty variable.
 */
const optional = (name: string) =>
  Config.option(Config.Redacted(name)).pipe(Config.map(Option.getOrUndefined));

const restart = { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 } as const;

export default Alchemy.Stack(
  "vantion",
  {
    providers: providers(),
    state: postgresState({ url: Config.Redacted("ALCHEMY_STATE_DATABASE_URL") }),
  },
  Effect.gen(function*() {
    const stage = yield* Alchemy.Stage;
    const target = Object.entries(targets).find(([name]) => name === stage)?.[1];

    if (target === undefined) {
      return yield* Effect.die(new UnknownStage({ stage, known: Object.keys(targets) }));
    }

    const api = hostOf("api", "api", target.domain);
    const web = hostOf("web", "app", target.domain);

    /** Every service's source: this repository, at the stage's branch. */
    const source = { repo: REPO, branch: target.branch } as const;

    /**
     * Traces, metrics and error tracking, which the API and the worker both
     * report through and both run without. The environment is the stage, so a
     * staging error never lands in production's issue list.
     */
    const telemetry = {
      OTEL_EXPORTER_OTLP_ENDPOINT: yield* optional("OTEL_EXPORTER_OTLP_ENDPOINT"),
      OTEL_EXPORTER_OTLP_HEADERS: yield* optional("OTEL_EXPORTER_OTLP_HEADERS"),
      SENTRY_DSN: yield* optional("SENTRY_DSN"),
      SENTRY_ENVIRONMENT: stage,
    };

    const project = yield* Project("project", { name: `vantion-${stage}` });

    /**
     * No public TCP proxy on either. Alchemy's default exposes Postgres on one
     * for laptop access, which is a database reachable from the internet with
     * nothing in front of it but a password — and nothing here needs it, since
     * migrations run inside the project as the API's pre-deploy step.
     */
    const postgres = yield* Postgres("postgres", {
      project,
      name: "postgres",
      public: false,
    });
    const redis = yield* Redis("redis", { project, name: "redis" });

    const database = {
      DATABASE_URL: ref(postgres, "DATABASE_URL"),
      REDIS_URL: ref(redis, "REDIS_URL"),
    };

    const apiService = yield* Service("api", {
      project,
      name: "api",
      ...source,
      dockerfilePath: "apps/server/Dockerfile",
      watchPatterns: watching("server"),
      // Migrations are a release step, never a boot step: two replicas
      // starting together would both migrate. The worker does not repeat it.
      preDeploy: { command: "bun packages/database/build/bundle/migrate.js" },
      healthcheckPath: "/health",
      healthcheckTimeout: 30,
      ...restart,
      env: {
        ...shared,
        ...database,
        ...telemetry,
        AUTH_BASE_URL: `https://${api.own}`,
        // better-auth trusts exactly this origin; a browser POST from any
        // other is refused, so it must be the web service's public address.
        WEB_URL: `https://${web.fromSibling}`,
        // Only with a domain of our own. The generated hosts cannot share a
        // cookie whatever this says.
        AUTH_COOKIE_DOMAIN: target.domain === undefined ? undefined : `.${target.domain}`,
        AUTH_SECRET: yield* required("AUTH_SECRET"),
        RESEND_API_KEY: yield* required("RESEND_API_KEY"),
        GOOGLE_CLIENT_ID: yield* optional("GOOGLE_CLIENT_ID"),
        GOOGLE_CLIENT_SECRET: yield* optional("GOOGLE_CLIENT_SECRET"),
        STRIPE_SECRET_KEY: yield* optional("STRIPE_SECRET_KEY"),
        STRIPE_WEBHOOK_SECRET: yield* optional("STRIPE_WEBHOOK_SECRET"),
        // The assistant and file uploads are served here, not by the worker —
        // `railway.ts` gave these to the worker, which never reads them.
        OPENROUTER_API_KEY: yield* optional("OPENROUTER_API_KEY"),
        ASSISTANT_MODEL: yield* optional("ASSISTANT_MODEL"),
        ASSISTANT_MODEL_ID: yield* optional("ASSISTANT_MODEL_ID"),
        S3_BUCKET: yield* optional("S3_BUCKET"),
        S3_REGION: yield* optional("S3_REGION"),
        S3_ENDPOINT: yield* optional("S3_ENDPOINT"),
        S3_ACCESS_KEY_ID: yield* optional("S3_ACCESS_KEY_ID"),
        S3_SECRET_ACCESS_KEY: yield* optional("S3_SECRET_ACCESS_KEY"),
      },
    });

    /**
     * No domain and no health check: it serves nothing. What the worker needs
     * is the queue, the database and whatever its jobs call out to.
     */
    const workerService = yield* Service("worker", {
      project,
      name: "worker",
      ...source,
      dockerfilePath: "apps/worker/Dockerfile",
      watchPatterns: watching("worker"),
      publicDomain: false,
      ...restart,
      env: {
        ...shared,
        ...database,
        ...telemetry,
        WEBHOOK_CONCURRENCY: yield* Config.option(Config.String("WEBHOOK_CONCURRENCY")).pipe(
          Config.map(Option.getOrUndefined),
        ),
      },
    });

    const webService = yield* Service("web", {
      project,
      name: "web",
      ...source,
      dockerfilePath: "apps/web/Dockerfile",
      watchPatterns: watching("web"),
      ...restart,
      env: {
        /**
         * A build argument as much as a runtime variable: Vite substitutes
         * `VITE_*` into the client bundle at build time, and Railway passes a
         * service variable to a Dockerfile `ARG` of the same name. It must be
         * the API's *public* address, because a browser resolves it.
         */
        VITE_AUTH_BASE_URL: `https://${api.fromSibling}`,
        WEB_URL: `https://${web.own}`,
        /**
         * Where server rendering calls the API: its *private* address, so a
         * request that never leaves the project does not go out to the edge
         * and back for every page. Plain HTTP because the private network is
         * already encrypted, and 3000 because that is the port the API's
         * Dockerfile sets. `server/rpc.ts` falls back to the public address
         * when this is unset, which works and costs the round trip.
         */
        AUTH_BASE_URL: `http://${ref("api", "RAILWAY_PRIVATE_DOMAIN")}:3000`,
      },
    });

    const marketing = yield* Service("marketing", {
      project,
      name: "marketing",
      ...source,
      dockerfilePath: "apps/marketing/Dockerfile",
      watchPatterns: watching("marketing"),
      ...restart,
    });

    const brand = yield* Service("brand", {
      project,
      name: "brand",
      ...source,
      dockerfilePath: "apps/brand/Dockerfile",
      watchPatterns: watching("brand"),
      ...restart,
    });

    /**
     * The two hostnames a browser uses, once the stage has a domain. Railway's
     * own config could not create these — its runner rejected a `domains`
     * entry — so they were a dashboard step; here they are two resources, and
     * what is left by hand is the DNS record each one reports.
     */
    const domains = target.domain === undefined ? [] : [
      yield* CustomDomain("api-domain", {
        service: apiService,
        environment: project,
        domain: `api.${target.domain}`,
      }),
      yield* CustomDomain("web-domain", {
        service: webService,
        environment: project,
        domain: `app.${target.domain}`,
      }),
    ];

    return {
      project: project.name,
      services: [apiService, workerService, webService, marketing, brand].map((service) =>
        service.name
      ),
      domains: domains.map((domain) => ({
        domain: domain.domain,
        verified: domain.verified,
        txtHost: domain.verificationDnsHost,
        txtValue: domain.verificationToken,
      })),
    };
  }),
);
