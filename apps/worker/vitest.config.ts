import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "worker",
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
      "#src/": path.join(import.meta.dirname, "src") + "/",
      "@test/": path.join(import.meta.dirname, "test") + "/",
    },
    // Shares the server's database.
    sequence: { concurrent: false, groupOrder: 2 },
    fileParallelism: false,
  },
});
