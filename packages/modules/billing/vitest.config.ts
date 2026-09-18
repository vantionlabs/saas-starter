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
    /**
     * Serial, and in the same group as the server, because these tests share
     * one database with it — the container and the migrations come from the
     * server project's `globalSetup`, which runs once before any project does.
     *
     * The generator writes this commented out; billing's tests touch Postgres,
     * so it is on. Running beside the server's meant two suites writing the
     * same tables.
     */
    sequence: { concurrent: false, groupOrder: 2 },
    fileParallelism: false,
  },
});
