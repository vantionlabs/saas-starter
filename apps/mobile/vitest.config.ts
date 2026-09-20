import * as path from "node:path";
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.ts";

export default mergeConfig(shared, {
  test: {
    name: "mobile",
    /**
     * Node, not a DOM: what is tested here is the logic a screen leans on —
     * the theme conversion, the formatting — rather than the screens. Rendering
     * React Native needs a native runtime or a renderer that fakes one, and a
     * test against a fake renderer proves less than the type-checker already
     * does about these components.
     */
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
    },
    include: ["test/**/*.test.ts"],
  },
});
