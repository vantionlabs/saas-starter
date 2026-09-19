import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Baseline } from "./Gate.js";
import { gate } from "./Gate.js";
import type { Graded } from "./Grade.js";
import { byCategory, grade } from "./Grade.js";
import { markdown } from "./Report.js";
import { observe } from "./Run.js";
import { modelName, readBaseline, readTestSet } from "./Suite.js";

const BASELINE = path.join(import.meta.dirname, "..", "baseline.json");

const main = Effect.gen(function*() {
  const model = modelName();

  if (model === "unconfigured") {
    yield* Effect.logError(
      "No model is configured. Set OPENROUTER_API_KEY, or ASSISTANT_MODEL=scripted to run the "
        + "deterministic set against the stand-in.",
    );

    return yield* Effect.sync(() => process.exit(1));
  }

  const set = yield* readTestSet();
  const graded: Array<Graded> = [];

  for (const testCase of set.cases) {
    graded.push(grade(testCase, yield* observe(testCase)));
  }

  const results = byCategory(graded);
  const criticalFailures = graded
    .filter((row) => !row.passed && row.severity === "critical")
    .map((row) => row.id);

  if (process.argv.includes("--update-baseline")) {
    const next: Baseline = {
      model,
      recordedAt: new Date().toISOString().slice(0, 10),
      categories: Object.fromEntries(results.map((row) => [row.category, row.passRate])),
      knownFailures: graded.filter((row) => !row.passed).map((row) => row.id),
    };

    fs.writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    yield* Effect.logInfo(`baseline recorded for ${model}`);

    return;
  }

  const baseline = readBaseline();
  const verdict = gate({ model, baseline, results, criticalFailures });

  yield* Effect.sync(() => {
    process.stdout.write(`${markdown({ model, results, graded, baseline, verdict })}\n`);
  });

  // `return yield*` because the process ends here: the linter wants the
  // generator's exit to be visible rather than inferred.
  if (!verdict.ok) return yield* Effect.sync(() => process.exit(1));
});

NodeRuntime.runMain(main);
