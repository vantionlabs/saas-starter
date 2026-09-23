import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const stack = read("alchemy.run.ts");
const workflow = read(".github/workflows/deploy.yml");
const envExample = read(".env.example");

const firstGroups = (source: string, pattern: RegExp): ReadonlyArray<string> =>
  [...source.matchAll(pattern)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

/**
 * Every variable the stack reads from the deploying environment.
 *
 * Read from the source rather than by running it: evaluating the stack needs a
 * Railway token and a state database, and the question here is only what names
 * it asks for.
 */
const stackReads = [
  ...new Set(
    firstGroups(stack, /(?:required|optional|Config\.(?:Redacted|String))\("([A-Z0-9_]+)"\)/g),
  ),
].sort();

/** The `env:` the deploy workflow hands the CLI, which both jobs share. */
const workflowPasses = [
  ...new Set(firstGroups(workflow, /^ {10}([A-Z0-9_]+): \$\{\{/gm)),
].sort();

/**
 * `alchemy.run.ts` is what production is, and like `.mcp.json` it rots in the
 * places nothing executes until a deploy does: a Dockerfile moved and the
 * service still names the old path, a secret the stack reads and CI never
 * passes, a variable nobody wrote down.
 *
 * Every one of these would otherwise surface as a failed deploy, on the one
 * push where finding out is most expensive.
 */
describe("the deployment", () => {
  it("builds every service from a Dockerfile that exists", () => {
    const paths = firstGroups(stack, /dockerfilePath: "([^"]+)"/g);

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((file) => !fs.existsSync(path.join(ROOT, file)))).toEqual([]);
  });

  /**
   * The watch patterns come from the same app the Dockerfile belongs to. A
   * service watching one app's closure while building another's image
   * redeploys on the wrong changes and misses the right ones.
   */
  it("watches the closure of the image it builds", () => {
    const services = [...stack.matchAll(
      /dockerfilePath: "apps\/([a-z-]+)\/Dockerfile",\s+watchPatterns: watching\("([a-z-]+)"\)/g,
    )];

    expect(services.length).toBe(firstGroups(stack, /dockerfilePath: "([^"]+)"/g).length);
    expect(services.filter(([, image, watched]) => image !== watched)).toEqual([]);
  });

  /**
   * A secret the stack reads and the workflow does not pass is an empty
   * optional variable at best and a failed plan at worst; one the workflow
   * passes and the stack never reads is a credential handed to a job for
   * nothing.
   */
  it("is handed exactly the variables it reads", () => {
    const needed = [...stackReads, "RAILWAY_API_TOKEN"].sort();

    expect(workflowPasses).toEqual(needed);
  });

  it("documents every variable it reads", () => {
    const missing = stackReads.filter((name) =>
      !new RegExp(`^#?\\s*${name}=`, "m").test(envExample)
    );

    expect(missing, "add these to .env.example").toEqual([]);
  });
});

/**
 * Every workflow, not only this one: an action pinned by tag runs whatever the
 * tag points at today, and the deploy job holds a token that can create and
 * delete infrastructure.
 */
describe("the workflows", () => {
  const workflows = fs.readdirSync(path.join(ROOT, ".github", "workflows"))
    .filter((file) => file.endsWith(".yml"))
    .map((file) => ({ file, source: read(path.join(".github", "workflows", file)) }));

  it("pin every action to a commit", () => {
    const floating = workflows.flatMap(({ file, source }) =>
      firstGroups(source, /uses: (\S+)/g)
        .filter((action) => !action.startsWith("./") && !/@[0-9a-f]{40}$/.test(action))
        .map((action) => `${file}: ${action}`)
    );

    expect(floating).toEqual([]);
  });

  it("start from a read-only token", () => {
    const writable = workflows
      .filter(({ source }) => !/^permissions:\n {2}contents: read$/m.test(source))
      .map(({ file }) => file);

    expect(writable).toEqual([]);
  });
});
