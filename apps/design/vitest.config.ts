import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "design",
    environment: "happy-dom",
    // Testing Library queries one shared document, so renders must not interleave.
    sequence: { concurrent: false },
    setupFiles: [path.join(import.meta.dirname, "test", "setup.ts")],
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
    },
    include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
  },
});
