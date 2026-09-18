import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(import.meta.dirname, "..", "new-module.mjs");

/**
 * Each test gets a repository of its own.
 *
 * The generator edits `tsconfig.base.json` and `tsconfig.json` in place, and
 * that is most of its value — but a test doing it to the real repo would be
 * rewriting files the other Vitest projects read while they run. `--root`
 * exists for exactly this.
 */
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "new-module-"));
  fs.mkdirSync(path.join(root, "packages", "modules"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.base.json"),
    JSON.stringify({ compilerOptions: { paths: {} } }, null, 2),
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ references: [{ path: "apps/server" }] }, null, 2),
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const run = (...args: ReadonlyArray<string>) =>
  execFileSync("node", [SCRIPT, ...args, "--root", root], { encoding: "utf8" });

/** The stderr of a run that was supposed to fail. */
const refusal = (...args: ReadonlyArray<string>) => {
  try {
    execFileSync("node", [SCRIPT, ...args, "--root", root], { stdio: "pipe" });
    return "";
  } catch (error) {
    return String((error as { stderr?: Buffer; }).stderr ?? "");
  }
};

const read = (...parts: ReadonlyArray<string>) =>
  fs.readFileSync(path.join(root, ...parts), "utf8");

const readJson = (...parts: ReadonlyArray<string>) => JSON.parse(read(...parts));

describe("new-module", () => {
  it("refuses a name that cannot be a directory, a package and an alias at once", () => {
    for (const name of ["Billing", "audit_log", "billing-", "2fa", "bill ing"]) {
      expect(refusal(name), name).toContain("invalid module name");
    }
  });

  it("refuses a name that looks like a flag", () => {
    expect(refusal("-billing")).toContain("usage:");
  });

  it("refuses to overwrite an existing module", () => {
    fs.mkdirSync(path.join(root, "packages", "modules", "iam"));

    expect(refusal("iam")).toContain("already exists");
  });

  it("plans without writing when asked to", () => {
    const output = run("planned", "--dry-run");

    expect(output).toContain("packages/modules/planned");
    expect(fs.existsSync(path.join(root, "packages", "modules", "planned"))).toBe(false);
    expect(readJson("tsconfig.base.json").compilerOptions.paths).toEqual({});
  });

  it("writes a module that follows the conventions", () => {
    run("billing");

    for (
      const file of [
        "package.json",
        "tsconfig.json",
        "tsconfig.src.json",
        "tsconfig.test.json",
        "vitest.config.ts",
        "src/Module.ts",
        "src/BillingRpc.ts",
        "src/BillingRpcLive.ts",
        "src/ListBilling.ts",
        "test/ListBilling.test.ts",
      ]
    ) {
      expect(fs.existsSync(path.join(root, "packages/modules/billing", file)), file).toBe(true);
    }

    expect(readJson("packages/modules/billing/package.json").name)
      .toBe("@vantion/module-billing");

    // The conventions that matter, asserted rather than assumed: the group file
    // only merges handlers, and the module exports a root layer to register.
    expect(read("packages/modules/billing/src/BillingRpcLive.ts"))
      .toContain("Layer.mergeAll(ListBilling)");
    expect(read("packages/modules/billing/src/Module.ts"))
      .toContain("export const BillingModule");
    expect(read("packages/modules/billing/src/ListBilling.ts"))
      .toContain("toLayerHandler");
  });

  it("registers the module where the compiler has to be told about it", () => {
    run("ledger");

    expect(readJson("tsconfig.base.json").compilerOptions.paths["@vantion/module-ledger/*"])
      .toEqual(["./packages/modules/ledger/src/*.js"]);

    const references = readJson("tsconfig.json").references
      .map((reference: { path: string; }) => reference.path);

    expect(references).toContain("packages/modules/ledger");
    // Ahead of the apps, so `tsc -b` builds it before whatever imports it.
    expect(references.indexOf("packages/modules/ledger")).toBeLessThan(
      references.indexOf("apps/server"),
    );
  });

  it("names a multi-word module consistently across all three spellings", () => {
    run("audit-log");

    expect(readJson("packages/modules/audit-log/package.json").name)
      .toBe("@vantion/module-audit-log");
    expect(fs.existsSync(path.join(root, "packages/modules/audit-log/src/AuditLogRpc.ts")))
      .toBe(true);
    expect(read("packages/modules/audit-log/src/Module.ts")).toContain("AuditLogModule");
  });

  it("leaves an existing module's registration alone when adding another", () => {
    run("first");
    run("second");

    const paths = readJson("tsconfig.base.json").compilerOptions.paths;

    expect(Object.keys(paths).sort())
      .toEqual(["@vantion/module-first/*", "@vantion/module-second/*"]);
  });
});
