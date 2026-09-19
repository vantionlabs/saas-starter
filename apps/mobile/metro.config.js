const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/**
 * Metro has to be told about the monorepo, twice.
 *
 * `watchFolders` is what makes a change in `packages/core` reload the app;
 * `nodeModulesPaths` is what lets it resolve a dependency pnpm hoisted to the
 * root. Neither is inferred, and the failure without them is a module-not-found
 * for a package that is plainly installed.
 */
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
/**
 * Hierarchical lookup stays *on*, which is the opposite of the advice written
 * for Yarn workspaces.
 *
 * pnpm does not hoist: `expo-router` lives in `.pnpm/...` and requires
 * `@expo/metro-runtime` from beside itself. Disabling the walk up the tree —
 * the usual monorepo tidying — is exactly what makes that unresolvable.
 */
config.resolver.unstable_enableSymlinks = true;

/**
 * The workspace packages expose their source under a `development` condition
 * and built JavaScript otherwise — the same arrangement Vite and Vitest use
 * here. Metro needs package exports enabled to see either, and the condition
 * named so it takes the TypeScript it can compile rather than a `build/`
 * directory that need not exist.
 */
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["development", "require", "import", "react-native"];

/**
 * The `@` alias, which every other tool here learns from `tsconfig.json`.
 *
 * Metro reads no tsconfig, so it is stated again — and the app's own imports
 * are extensionless rather than `.js`, because that suffix is a Node ESM idiom
 * Metro does not translate back to `.tsx`. The workspace packages keep theirs:
 * they are resolved through their `exports` maps, which do map it.
 */
config.resolver.alias = { "@": path.resolve(projectRoot, "src") };

/**
 * `./Foo.js` inside a workspace package means `./Foo.ts`.
 *
 * Every package here writes relative imports with a `.js` extension, which is
 * what Node's ESM resolver wants and what `tsc` emits against. Vite and Vitest
 * map it back to the TypeScript source; Metro resolves literally and fails on a
 * file that is never written to disk.
 *
 * So the extension is retried rather than the repository being rewritten: the
 * convention is correct for the six packages Node actually runs, and this is
 * the one consumer that does not speak it.
 */
const withTypeScript = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const stem = moduleName.slice(0, -3);

    for (const extension of [".ts", ".tsx"]) {
      try {
        return context.resolveRequest(context, stem + extension, platform);
      } catch {
        // Not TypeScript after all — fall through to the original specifier,
        // which is right for a package shipping real JavaScript.
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.resolveRequest = withTypeScript;

module.exports = withNativeWind(config, { input: "./src/global.css" });
