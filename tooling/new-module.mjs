#!/usr/bin/env node
// Scaffolds a feature module under packages/modules/.
//
// A module is five config files before it is a line of code, and two of those
// register it somewhere else — a reference in the root tsconfig, a path in the
// base one. Written by hand, the fifth module is where one of them gets
// forgotten and the failure reads as a resolution error three files away.
//
//   node tooling/new-module.mjs billing
//   node tooling/new-module.mjs audit-log --dry-run
//
// It writes a worked `List…` operation so the shape RULES.md describes is in
// the tree rather than only in prose: one file per operation built with
// `toLayerHandler`, an `*RpcLive` that only merges them, and a `Module.ts` root
// layer for an application to register.

import * as fs from "node:fs";
import * as path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

/**
 * The repository to write into. Defaults to this one.
 *
 * Only the tests pass it: the generator edits `tsconfig.base.json` and
 * `tsconfig.json` in place, and a test that did that to the real repo would be
 * mutating files the other Vitest projects are reading at the same time.
 */
const rootFlag = args.indexOf("--root");
const ROOT = rootFlag === -1
  ? path.join(import.meta.dirname, "..")
  : path.resolve(args[rootFlag + 1] ?? "");

const positional = rootFlag === -1
  ? args
  : args.filter((_, index) => index !== rootFlag && index !== rootFlag + 1);

const name = positional.find((arg) => !arg.startsWith("-"));

if (name === undefined) {
  console.error("usage: node tooling/new-module.mjs <name> [--dry-run]");
  process.exit(1);
}

// Lowercase and hyphenated, because it becomes a directory, a package name and
// a path alias, and only one spelling can be right in all three.
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error(
    `invalid module name: ${name}\nuse lowercase words separated by hyphens, e.g. audit-log`,
  );
  process.exit(1);
}

const pascal = name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
const pkg = `@vantion/module-${name}`;
const dir = path.join("packages", "modules", name);
const absolute = path.join(ROOT, dir);

if (fs.existsSync(absolute)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}

const json = (value) => JSON.stringify(value, null, 2) + "\n";

/**
 * Every module can reach the database and iam. Depending on something it does
 * not use costs nothing and is one less thing to notice missing; a module that
 * genuinely needs neither can have them deleted.
 */
const CROSS_PATHS = {
  "@vantion/database/*": ["../../../packages/database/src/*.js"],
  "@vantion/module-iam/*": ["../../../packages/modules/iam/src/*.js"],
};

const files = {
  "package.json": json({
    name: pkg,
    version: "0.0.0",
    private: true,
    type: "module",
    license: "MIT",
    exports: {
      "./package.json": "./package.json",
      "./*": {
        development: "./src/*.ts",
        types: "./src/*.ts",
        default: "./build/src/*.js",
      },
    },
    scripts: {
      check: "tsc -b tsconfig.json",
      test: "vitest run",
      build: "tsc -b tsconfig.json",
    },
    dependencies: {
      "@vantion/database": "workspace:*",
      "@vantion/module-iam": "workspace:*",
      effect: "catalog:",
    },
    devDependencies: {
      "@effect/vitest": "catalog:",
      vitest: "catalog:",
    },
  }),

  "tsconfig.json": json({
    extends: "../../../tsconfig.base.json",
    include: [],
    files: [],
    references: [{ path: "tsconfig.src.json" }, { path: "tsconfig.test.json" }],
  }),

  "tsconfig.src.json": json({
    extends: "../../../tsconfig.base.json",
    include: ["src"],
    exclude: ["src/**/*.test.ts"],
    references: [{ path: "../../database" }, { path: "../iam" }],
    compilerOptions: {
      types: ["node"],
      outDir: "build/src",
      tsBuildInfoFile: ".tsbuildinfo/src.tsbuildinfo",
      rootDir: "src",
      paths: { "@/*": ["${configDir}/src/*"], ...CROSS_PATHS },
    },
  }),

  "tsconfig.test.json": json({
    extends: "../../../tsconfig.base.json",
    include: ["test", "src/**/*.test.ts"],
    references: [
      { path: "tsconfig.src.json" },
      { path: "../../database" },
      { path: "../iam" },
    ],
    compilerOptions: {
      types: ["node"],
      noEmit: true,
      tsBuildInfoFile: ".tsbuildinfo/test.tsbuildinfo",
      paths: { "@/*": ["./src/*"], "@test/*": ["./test/*"], ...CROSS_PATHS },
    },
  }),

  "vitest.config.ts": `import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "${name}",
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
      "@test/": path.join(import.meta.dirname, "test") + "/",
    },
    // Uncomment when this module's tests touch Postgres: they then share one
    // database with the server's and must not run beside them.
    // sequence: { concurrent: false, groupOrder: 2 },
    // fileParallelism: false,
  },
});
`,

  [`src/${pascal}Rpc.ts`]: `import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

/**
 * The ${name} contract, which both ends compile against.
 *
 * Replace this with the real procedures. Payload and success schemas belong
 * here, beside the group, so a change to either breaks the client at build time
 * rather than in production.
 */
export const ${pascal}Rpcs = RpcGroup.make(
  Rpc.make("List${pascal}", { success: Schema.Array(Schema.String) }),
);
`,

  [`src/List${pascal}.ts`]: `import { Effect } from "effect";
import { ${pascal}Rpcs } from "./${pascal}Rpc.js";

/**
 * One operation, one file.
 *
 * \`toLayerHandler\` implements a single procedure, so this handler declares
 * whatever it needs — \`SqlClient\`, \`CurrentUser\` — by yielding it here, rather
 * than inheriting it from a closure it happens to share.
 */
export const List${pascal} = ${pascal}Rpcs.toLayerHandler(
  "List${pascal}",
  () => Effect.succeed([]),
);
`,

  [`src/${pascal}RpcLive.ts`]: `import { Layer } from "effect";
import { List${pascal} } from "./List${pascal}.js";

/** The ${name} group: a merge of its handlers, and nothing else. */
export const ${pascal}RpcLive = Layer.mergeAll(List${pascal});
`,

  "src/Module.ts": `import { ${pascal}RpcLive } from "./${pascal}RpcLive.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * Provide this module's own services into it with \`Layer.provideMerge\`, so they
 * are wired into its handlers and still visible to callers outside it. Leave
 * infrastructure — \`SqlClient\`, \`Mailer\`, \`RateLimiter\` — in the requirements:
 * providing it is the host's job, and refusing to is what lets one layer serve
 * an HTTP API, an MCP server or a worker alike.
 *
 * HTTP routes, if this module gains any, are exported separately as
 * \`${pascal}Http\`. A route layer requires the \`HttpRouter\` it adds itself to,
 * and that service only exists inside \`HttpRouter.serve\`.
 */
export const ${pascal}Module = ${pascal}RpcLive;
`,

  [`test/List${pascal}.test.ts`]: `import { describe, expect, it } from "vitest";
import { ${pascal}Rpcs } from "@/${pascal}Rpc.js";

describe("${name}", () => {
  it("declares its procedures", () => {
    expect(${pascal}Rpcs.requests.has("List${pascal}")).toBe(true);
  });
});
`,
};

/** Adds the module where the compiler has to be told about it. */
const registrations = [
  {
    file: "tsconfig.base.json",
    apply: (d) => {
      d.compilerOptions.paths[`${pkg}/*`] = [`./${dir}/src/*.js`];
      return d;
    },
    describe: `path alias ${pkg}/*`,
  },
  {
    file: "tsconfig.json",
    apply: (d) => {
      if (!d.references.some((r) => r.path === dir)) {
        // Before the apps, so `tsc -b` builds it first.
        d.references.unshift({ path: dir });
      }
      return d;
    },
    describe: `project reference ${dir}`,
  },
];

if (dryRun) {
  console.log(`would create ${dir}/`);
  for (const file of Object.keys(files)) console.log(`  ${file}`);
  for (const { describe } of registrations) console.log(`would register ${describe}`);
  process.exit(0);
}

for (const [file, content] of Object.entries(files)) {
  const target = path.join(absolute, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

for (const { file, apply } of registrations) {
  const target = path.join(ROOT, file);
  fs.writeFileSync(target, json(apply(JSON.parse(fs.readFileSync(target, "utf8")))));
}

console.log(`created ${dir}

Next, in order:

  1. pnpm install                      link the workspace package
  2. add "${pkg}": "workspace:*" to the dependencies of whatever
     imports it — packages/domain to put its procedures in AppRpcs, and each
     app that registers it
  3. add ${pascal}Rpcs to packages/domain/src/AppRpcs.ts
  4. register ${pascal}Module in apps/server/src/Main.ts
  5. pnpm check && pnpm lint && pnpm test

Steps 3 and 4 are deliberately yours: what an application serves is a decision,
not a side effect of creating a directory.`);
