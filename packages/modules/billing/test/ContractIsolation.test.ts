import { describe, expect, it } from "@effect/vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const src = path.join(import.meta.dirname, "..", "src");

/** Every relative import a file makes, as a resolved `.ts` path. */
const importsOf = (file: string): ReadonlyArray<string> =>
  [...fs.readFileSync(file, "utf8").matchAll(/from\s+"(\.[^"]+)"/g)]
    .map((match) => path.resolve(path.dirname(file), match[1]!.replace(/\.js$/, ".ts")));

const reachableFrom = (entry: string): ReadonlySet<string> => {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file) || !fs.existsSync(file)) continue;

    seen.add(file);
    queue.push(...importsOf(file));
  }

  return seen;
};

/**
 * The contract is what both ends of the application compile against, so
 * everything it reaches is shipped to the browser.
 *
 * `Stripe.ts` is loaded through a dynamic `import` precisely so a process
 * without a key never runs the SDK — but a bundler follows that import
 * statically, and for one commit the web app's browser bundle carried 135 kB of
 * Stripe's Node SDK. The type-checker cannot see that, and neither can a
 * browser test, so this asserts the shape instead.
 */
describe("the billing contract", () => {
  it("does not reach the Stripe SDK", () => {
    const reachable = reachableFrom(path.join(src, "BillingRpc.ts"));

    expect([...reachable].map((file) => path.basename(file))).not.toContain("Stripe.ts");
    expect([...reachable].map((file) => path.basename(file))).not.toContain("StripeClient.ts");
  });

  it("reaches the errors it declares, so the assertion above can fail", () => {
    const reachable = reachableFrom(path.join(src, "BillingRpc.ts"));

    expect([...reachable].map((file) => path.basename(file))).toContain("BillingErrors.ts");
  });
});
