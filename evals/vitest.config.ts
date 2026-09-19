import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "evals",
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
    },
    /**
     * The set runs against the same database as the server's tests and takes
     * a turn per case, so it runs alone and last.
     */
    sequence: { concurrent: false, groupOrder: 3 },
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
