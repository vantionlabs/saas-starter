import * as path from "node:path";
import { defineConfig } from "vite";

/**
 * Bundles the worker into one file, the same way the API is bundled and with
 * the same reasoning: a bundle carries only the code actually reached, which is
 * the difference between shipping a dependency tree and shipping a file.
 */
export default defineConfig({
  resolve: {
    conditions: ["development"],
    alias: {
      "#src": path.resolve(import.meta.dirname, "./src"),
    },
  },
  ssr: {
    noExternal: true,
    // `pg` reaches for these only on paths this never takes; `bullmq` loads its
    // Lua scripts from disk, so it stays external rather than being inlined.
    external: ["pg-native", "pg-cloudflare", "bullmq", "ioredis"],
  },
  build: {
    ssr: "src/Main.ts",
    outDir: "build/bundle",
    target: "node22",
    sourcemap: true,
    rollupOptions: { output: { entryFileNames: "main.js" } },
  },
});
