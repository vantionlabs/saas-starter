import { pages } from "@/site.js";
import { describe, expect, it } from "@effect/vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTES = path.join(import.meta.dirname, "..", "src", "routes");

/** Every route file, as the path it serves. */
const routeFiles = (): ReadonlyArray<{ readonly file: string; readonly route: string; }> => {
  const walk = (dir: string): Array<string> =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : entry.name.endsWith(".tsx")
        ? [path.join(dir, entry.name)]
        : []
    );

  return walk(ROUTES)
    .filter((file) => !file.endsWith("__root.tsx"))
    .map((file) => {
      const relative = path.relative(ROUTES, file).replace(/\.tsx$/, "");

      return { file, route: relative === "index" ? "/" : `/${relative}` };
    });
};

/**
 * The pages, the navigation and the sitemap are one list.
 *
 * Three places that must agree, so they are asserted against each other rather
 * than maintained in parallel: a route nobody can reach, and a nav link to
 * nothing, are both silent failures on a marketing site.
 */
describe("the routes", () => {
  it("are exactly the pages the site declares", () => {
    const declared = pages.map((page) => page.path).sort();
    const actual = routeFiles().map((entry) => entry.route).sort();

    expect(actual).toEqual(declared);
  });

  it("each set their own head through `meta`", () => {
    for (const { file, route } of routeFiles()) {
      const source = fs.readFileSync(file, "utf8");

      expect(source, `${route} does not call meta()`).toContain("head: () => meta(");
      expect(source, `${route} does not name its own path`).toContain(`path: "${route}"`);
    }
  });
});
