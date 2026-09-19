import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { readDockerfile, requiredManifestDirs, workspacePackages } from "../DockerManifests.js";

const REPO = path.join(import.meta.dirname, "..", "..");

/**
 * Every app that ships an image. Listed rather than globbed, because an app
 * without a Dockerfile is a decision — `apps/design` deploys nothing and
 * `apps/mcp` runs as a subprocess of an editor — and a glob would quietly stop
 * covering one that gained a file.
 */
const IMAGES = ["server", "web", "admin", "worker", "marketing", "brand"] as const;

describe("image manifests", () => {
  /**
   * The check that would have caught it. All six `deps` stages had drifted from
   * the workspace — `packages/modules/health` was in none of them — and the
   * build failed on a missing npm package rather than a missing `COPY` line,
   * three files from the cause.
   *
   * Nothing in CI builds an image, so this is the gate that runs on every push.
   * `.github/workflows/nightly.yml` builds them for real, a day later.
   */
  it.each(IMAGES)("%s copies every manifest its build reaches", (app) => {
    const required = requiredManifestDirs(REPO, app);
    const { copied } = readDockerfile(REPO, app);

    const missing = required.filter((dir) => !copied.has(dir));
    expect(
      missing,
      `apps/${app}/Dockerfile is missing:\n${
        missing.map((d) => `COPY ${d}/package.json ${d}/`).join("\n")
      }`,
    ).toEqual([]);
  });

  /**
   * The other direction, and not pedantry: a manifest an image does not need is
   * a layer invalidated by a change that cannot affect it. `apps/server` copied
   * `apps/web`'s, so every front-end dependency bump rebuilt the API's install.
   */
  it.each(IMAGES)("%s copies nothing it does not reach", (app) => {
    const required = new Set(requiredManifestDirs(REPO, app));
    const { copied } = readDockerfile(REPO, app);

    expect([...copied].filter((dir) => !required.has(dir))).toEqual([]);
  });

  /**
   * The closure is only as good as its roots. If a Dockerfile stops naming what
   * it builds — renamed filters, a build moved into a script — the two tests
   * above start asserting over an empty set and pass while proving nothing.
   */
  it.each(IMAGES)("%s names a workspace package to build", (app) => {
    const packages = workspacePackages(REPO);
    const { built } = readDockerfile(REPO, app);

    for (const name of built) {
      expect(packages.has(name), `${name} is not a workspace package`).toBe(true);
    }
  });
});
