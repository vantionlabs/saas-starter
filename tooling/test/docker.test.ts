import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  builtPackages,
  readDockerfile,
  requiredBuildTargets,
  requiredManifestDirs,
  workspacePackages,
} from "../DockerManifests.js";

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
   * The second failure the nightly found, and the reason it is worth a test of
   * its own: copying a manifest installs a package, it does not build one.
   *
   * A workspace package resolves to `build/src/*.js` under its `default` export
   * condition, and `.dockerignore` keeps build output out of the context — so a
   * *value* imported from a module does not resolve until something has built
   * it, while every type-only import beside it is erased and never notices.
   * `MAX_UPLOAD_BYTES` in `routes/_protected/files.tsx` was one such line among
   * sixteen imports from the same packages.
   *
   * `tsc -b` follows project references, so five of the six images were correct
   * by accident: building `@vantion/domain` built the modules under it. That is
   * the same fact written in a second place, and an app depending on something
   * `domain` does not reference would be wrong in a way only a bundle shows.
   * `--filter "<app>..."` says it once, and this asserts it.
   */
  it.each(IMAGES)("%s builds every package it imports values from", (app) => {
    const required = requiredBuildTargets(REPO, app);
    const built = builtPackages(REPO, app);

    const missing = required.filter((name) => !built.has(name));
    expect(missing, `apps/${app}/Dockerfile builds its app but not:\n${missing.join("\n")}`)
      .toEqual([]);
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
