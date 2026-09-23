import { execFileSync, spawnSync } from "node:child_process";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");
const SCRIPT = path.join(ROOT, "alchemy.dry-run.ts");

interface Planned {
  readonly type: string;
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
}

let stages: Readonly<Record<string, ReadonlyArray<Planned>>> = {};

/** Both stages, once: the engine's real plan and apply, against nothing. */
beforeAll(() => {
  const output = execFileSync("bun", [SCRIPT, "--json"], { cwd: ROOT, encoding: "utf8" });
  const json = output.trim().split("\n").at(-1) ?? "{}";

  stages = JSON.parse(json) as Record<string, ReadonlyArray<Planned>>;
}, 120_000);

const props = (stage: string, id: string): Readonly<Record<string, unknown>> => {
  const found = stages[stage]?.find((resource) => resource.id === id);
  expect(found, `${stage} did not plan ${id}`).toBeDefined();

  return found?.props ?? {};
};

const env = (stage: string, id: string): Readonly<Record<string, unknown>> => {
  const variables = props(stage, id)["env"];

  return typeof variables === "object" && variables !== null ? { ...variables } : {};
};

/**
 * `alchemy.run.ts` deployed for real — the engine's own plan and apply —
 * against stand-in providers that talk to nothing, which is what
 * `bun run deploy:dry-run` prints. It proves the half of a deploy that is
 * ours: the program evaluates for every stage, every reference names a
 * service that exists, and every variable lands on the process that reads it.
 * Whether Railway accepts the result is the other half, and needs a token.
 */
describe.each(["staging", "prod"])("a dry run of %s", (stage) => {
  it("plans the whole deployment", () => {
    expect(stages[stage]?.map(({ type, id }) => `${type} ${id}`).sort()).toEqual([
      "Railway.Postgres postgres",
      "Railway.Project project",
      "Railway.Redis redis",
      "Railway.Service api",
      "Railway.Service brand",
      "Railway.Service marketing",
      "Railway.Service web",
      "Railway.Service worker",
    ]);

    expect(props(stage, "project")["name"]).toBe(`vantion-${stage}`);
    expect(props(stage, "api")["branch"]).toBe(stage === "prod" ? "main" : "staging");
  });

  it("exposes nothing that serves nobody", () => {
    expect(props(stage, "postgres")["public"]).toBe(false);
    expect(props(stage, "worker")["publicDomain"]).toBe(false);
  });

  /**
   * Railway resolves `${{name.VAR}}` by service name, and a template naming a
   * service that does not exist resolves to an empty string rather than an
   * error — so a typo here is an application pointed at nothing.
   */
  it("references services by the names they are created with", () => {
    const names = new Set(stages[stage]?.map(({ props: { name } }) => name));
    const referenced = (stages[stage] ?? []).flatMap(({ props: planned }) =>
      Object.values((planned["env"] ?? {}) as Record<string, unknown>)
        .flatMap((value) => [...String(value).matchAll(/\$\{\{(\w+)\.\w+\}\}/g)])
        .flatMap(([, service]) => (service === undefined ? [] : [service]))
    );

    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((service) => !names.has(service))).toEqual([]);

    expect(env(stage, "api")["DATABASE_URL"]).toBe("${{postgres.DATABASE_URL}}");
    expect(env(stage, "web")["API_URL"]).toBe("http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000");
  });

  /**
   * One origin. The browser talks to the web service, which forwards the API's
   * routes, so nothing may point a browser elsewhere or scope a cookie to a
   * parent domain — either would reintroduce the cross-site cookie that cannot
   * work on generated hosts and fails silently when it is wrong.
   */
  it("points browsers at the web service and nowhere else", () => {
    expect(env(stage, "api")["WEB_URL"]).toBe("https://${{web.RAILWAY_PUBLIC_DOMAIN}}");
    expect(env(stage, "api")).not.toHaveProperty("AUTH_BASE_URL");
    expect(env(stage, "api")).not.toHaveProperty("AUTH_COOKIE_DOMAIN");
    expect(env(stage, "web")).not.toHaveProperty("VITE_AUTH_BASE_URL");
  });

  it("gives a secret only to the process that reads it", () => {
    expect(env(stage, "api")["AUTH_SECRET"]).toBe("<secret>");
    expect(env(stage, "worker")).not.toHaveProperty("AUTH_SECRET");
    expect(env(stage, "web")).not.toHaveProperty("DATABASE_URL");
  });

  /**
   * The dry run blanks the environment, so an optional secret that appears
   * here came from somewhere it should not have — a developer's `.env`.
   */
  it("writes no variable for an optional secret nobody set", () => {
    expect(env(stage, "api")).not.toHaveProperty("S3_BUCKET");
    expect(env(stage, "api")).not.toHaveProperty("STRIPE_SECRET_KEY");
  });
});

it("refuses a stage it has no target for", () => {
  const result = spawnSync("bun", [SCRIPT, "--stage", "live_somebody"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain("No target for stage");
}, 60_000);
