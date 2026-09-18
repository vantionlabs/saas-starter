import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "iam",
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
      "@test/": path.join(import.meta.dirname, "test") + "/",
    },
    /**
     * Serial, and in the same group as the server, because these tests share
     * one database with it. The container and the migrations come from the
     * server project's `globalSetup`, which Vitest runs once for the whole run
     * before any project starts.
     */
    sequence: { concurrent: false, groupOrder: 2 },
    fileParallelism: false,
  },
});
