import { mergeConfig } from "vitest/config";
import shared from "../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "tooling",
    /**
     * Serial. These tests spawn a process per case and each owns a temporary
     * repository, which the shared config's `sequence.concurrent` turns into
     * one `root` shared between interleaved tests.
     */
    sequence: { concurrent: false },
  },
});
