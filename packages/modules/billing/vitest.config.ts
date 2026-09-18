import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "billing",
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
