import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Config files rather than directories. A bare `packages/*` also matches
     * `packages/modules`, which is a container rather than a project, and
     * Vitest would happily run it as one — collecting every module's tests
     * under a project with no aliases, where every `@/` import fails to
     * resolve.
     */
    projects: [
      "apps/*/vitest.config.ts",
      "packages/*/vitest.config.ts",
      "packages/modules/*/vitest.config.ts",
      "tooling/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      include: [
        "apps/*/src/**/*.ts",
        "packages/*/src/**/*.ts",
        "packages/modules/*/src/**/*.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
