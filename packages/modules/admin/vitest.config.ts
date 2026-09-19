import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "admin",
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
      "@test/": path.join(import.meta.dirname, "test") + "/",
    },
    // These touch Postgres, and share one database with every other module's
    // tests, so they do not run beside them.
    sequence: { concurrent: false, groupOrder: 2 },
    fileParallelism: false,
  },
});
