/**
 * Which workspace manifests an image's `deps` stage has to copy.
 *
 * Every Dockerfile installs from a *subset* of the workspace: copying only the
 * manifests an image needs is what keeps a source change from reinstalling the
 * world, and copying all of them would pull React Native, Expo and Playwright
 * into images that never run a phone or a browser.
 *
 * A subset is a registration somewhere else, though, and this one was wrong in
 * all six images at once — `packages/modules/health` appeared in none of them.
 * `tsc -b` follows project references and `@vantion/domain` aggregates every
 * module, so building it reached packages whose dependencies had never been
 * installed, and the failure read as `Cannot find module '@aws-sdk/client-s3'`
 * rather than as a missing `COPY` line three files away.
 *
 * So the list is computed here and asserted by `tooling/test/docker.test.ts`,
 * which runs in `pnpm test`. The nightly image build would have caught it too,
 * a day later and only if somebody read the run.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface WorkspacePackage {
  readonly name: string;
  /** Repository-relative, which is how a Dockerfile spells it. */
  readonly dir: string;
  readonly workspaceDeps: ReadonlySet<string>;
  /**
   * Whether a consumer importing a *value* from this package needs it built
   * first: true when its `default` export condition points into `build/`.
   *
   * That condition is what a bundler and Metro resolve through, and build
   * output is in neither a fresh checkout nor a Docker context. Type-only
   * imports are erased and resolve nothing, which is why this failed on one
   * line out of sixteen rather than everywhere at once.
   */
  readonly buildRequired: boolean;
}

/**
 * Where `pnpm-workspace.yaml` says packages live. Kept as literal directories
 * rather than read from that file: the globs are `apps/*`, `packages/*`,
 * `packages/modules/*` and `scripts`, and a glob matcher to re-derive four
 * known paths would be the more fragile of the two.
 */
const ROOTS = ["apps", "packages", "packages/modules"] as const;

const manifestDirs = (repo: string): Array<string> => {
  const dirs = ["scripts"];

  for (const root of ROOTS) {
    const absolute = path.join(repo, root);
    if (!fs.existsSync(absolute)) continue;

    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.posix.join(root, entry.name);
      // `packages/modules` is a container, not a package.
      if (fs.existsSync(path.join(repo, dir, "package.json"))) dirs.push(dir);
    }
  }

  return dirs;
};

export const workspacePackages = (repo: string): Map<string, WorkspacePackage> => {
  const packages = new Map<string, WorkspacePackage>();

  for (const dir of manifestDirs(repo)) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repo, dir, "package.json"), "utf8"),
    ) as {
      name: string;
      scripts?: Record<string, string>;
      exports?: Record<string, unknown>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const declared = { ...manifest.dependencies, ...manifest.devDependencies };
    const workspaceDeps = new Set(
      Object.entries(declared)
        .filter(([, range]) => range.startsWith("workspace:"))
        .map(([name]) => name),
    );

    /**
     * The `default` condition specifically, not `development`: every dev tool
     * here asks for `development` and gets source, and a Docker build or a
     * Metro bundle is exactly the case that does not.
     */
    const subpath = manifest.exports?.["./*"] ?? manifest.exports?.["."];
    const fallback = typeof subpath === "object" && subpath !== null
      ? (subpath as Record<string, unknown>)["default"]
      : subpath;

    const buildRequired = manifest.scripts?.["build"] !== undefined
      && typeof fallback === "string"
      && fallback.includes("/build/");

    packages.set(manifest.name, { name: manifest.name, dir, workspaceDeps, buildRequired });
  }

  return packages;
};

/**
 * The root manifest's own workspace dependencies — `@vantion/scripts`, which
 * carries the oxlint plugin. `pnpm install` installs these whatever is
 * filtered, so they belong in every image's closure.
 */
const rootWorkspaceDeps = (repo: string): Array<string> => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(([, range]) => range.startsWith("workspace:"))
    .map(([name]) => name);
};

/** Every workspace package reachable from `roots`, including the roots. */
const closure = (
  packages: Map<string, WorkspacePackage>,
  roots: Iterable<string>,
): Set<string> => {
  const seen = new Set<string>();
  const pending = [...roots];

  while (pending.length > 0) {
    const name = pending.pop()!;
    if (seen.has(name)) continue;

    const pkg = packages.get(name);
    // A published dependency, not a workspace one.
    if (pkg === undefined) continue;

    seen.add(name);
    pending.push(...pkg.workspaceDeps);
  }

  return seen;
};

interface BuildFilter {
  readonly name: string;
  /** `--filter "@vantion/web..."` — pnpm for "and its dependencies". */
  readonly withDeps: boolean;
}

export interface DockerfileFacts {
  readonly app: string;
  /** Every `--filter` in a `RUN pnpm … build`, as written. */
  readonly filters: Array<BuildFilter>;
  /** Just their names, which is what the manifest closure is rooted at. */
  readonly built: Array<string>;
  /** Directories whose `package.json` the `deps` stage copies. */
  readonly copied: Set<string>;
}

/**
 * Every first capture group, with the misses dropped rather than asserted away.
 * A group that did not participate is `undefined` at the type level and cannot
 * be here at all in practice — but `!` is the spelling this repository does not
 * use, and a `flatMap` says the same thing to the compiler.
 */
const captures = (source: string, pattern: RegExp): Array<string> =>
  [...source.matchAll(pattern)].flatMap((match) => {
    const [, first] = match;
    return first === undefined ? [] : [first];
  });

export const readDockerfile = (repo: string, app: string): DockerfileFacts => {
  const source = fs.readFileSync(path.join(repo, "apps", app, "Dockerfile"), "utf8");

  const filters = [...source.matchAll(/^RUN pnpm .*--filter.*\bbuild\b.*$/gm)]
    .flatMap(([line]) => captures(line, /--filter (\S+)/g))
    .map((raw) => {
      // The quotes are for the reader; the shell would eat nothing here either
      // way. `...` is pnpm for "and its dependencies".
      const unquoted = raw.replace(/^["']|["']$/g, "");
      const withDeps = unquoted.endsWith("...");
      return { name: withDeps ? unquoted.slice(0, -3) : unquoted, withDeps };
    });

  const copied = new Set(captures(source, /^COPY (\S+)\/package\.json/gm));

  return { app, filters, built: filters.map(({ name }) => name), copied };
};

/** What `RUN pnpm … build` actually builds, with `...` expanded. */
export const builtPackages = (repo: string, app: string): Set<string> => {
  const packages = workspacePackages(repo);
  const { filters } = readDockerfile(repo, app);

  const built = new Set<string>();
  for (const { name, withDeps } of filters) {
    if (withDeps) { for (const dep of closure(packages, [name])) built.add(dep); }
    else built.add(name);
  }

  return built;
};

/**
 * What this image has to build before its app, because a value imported from
 * one of these resolves to build output a fresh context does not have.
 *
 * `tsc -b` does follow project references, so building `@vantion/domain` builds
 * the modules beneath it and an image can be correct without naming them. This
 * is deliberately stricter: the reference graph is a second place the same fact
 * is written, and an app depending on something `domain` does not reference
 * would be wrong in a way only a bundle would show.
 */
export const requiredBuildTargets = (repo: string, app: string): Array<string> => {
  const packages = workspacePackages(repo);
  const self = `@vantion/${app}`;

  return [...closure(packages, [self])]
    .filter((name) => name !== self && packages.get(name)?.buildRequired === true)
    .sort();
};

/** The directories `app`'s `deps` stage must copy, sorted as they should be written. */
export const requiredManifestDirs = (repo: string, app: string): Array<string> => {
  const packages = workspacePackages(repo);
  const facts = readDockerfile(repo, app);

  const roots = [...facts.built, ...rootWorkspaceDeps(repo)];
  // A Dockerfile that builds nothing with a filter still installs for its app.
  if (facts.built.length === 0) roots.push(`@vantion/${app}`);

  return [...closure(packages, roots)]
    .map((name) => packages.get(name)!.dir)
    .sort();
};
