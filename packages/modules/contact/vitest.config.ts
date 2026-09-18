import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "contact",
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
      "@test/": path.join(import.meta.dirname, "test") + "/",
    },
    /** Serial, and in the server's group: these tests share its database. */
    sequence: { concurrent: false, groupOrder: 2 },
    fileParallelism: false,
  },
});
