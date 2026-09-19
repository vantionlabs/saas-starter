import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.join(import.meta.dirname, "..", "..");

const sources = (dir: string): Array<string> => {
  const absolute = path.join(REPO, dir);
  if (!fs.existsSync(absolute)) return [];

  return fs.readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes(`${path.sep}build${path.sep}`));
};

/**
 * Server functions are reads.
 *
 * A write is a form on the client, built with effect-form, which is where the
 * person making the change already is. A `POST` server function is the shape
 * that invites the other thing: a mutation reached through the render server,
 * duplicating an RPC that already exists and authenticates itself.
 *
 * Checked here rather than left to review because the rule is invisible at the
 * call site — `createServerFn({ method: "POST" })` reads perfectly well, and
 * nothing about it says which half of the application it belongs to.
 */
describe("server functions", () => {
  it("are never POST", () => {
    const offenders = ["apps/web/src", "apps/admin/src"]
      .flatMap(sources)
      .filter((file) => /createServerFn\(\{\s*method:\s*"POST"/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(REPO, file));

    expect(offenders, "a write belongs in an effect-form on the client").toEqual([]);
  });
});
