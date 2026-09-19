import { gate } from "@/Gate.js";
import { byCategory, grade, type Graded } from "@/Grade.js";
import { markdown } from "@/Report.js";
import { observe } from "@/Run.js";
import { readBaseline, readTestSet } from "@/Suite.js";
import { describe, expect, it } from "@effect/vitest";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { layerScripted } from "@vantion/module-assistant/Model";
import { Effect } from "effect";

/**
 * The eval set, as a gate the build runs.
 *
 * Against the scripted model, deliberately and explicitly. What this can
 * enforce on every push is the half that must hold whatever a model says: the
 * right tool is reached for, a write stops and asks, a refusal comes back
 * named, and one tenant's question never reaches another's rows. A real model
 * cannot make those *more* true — it would only make the run cost money and
 * answer differently each time.
 *
 * The quality half — does a model choose well, does the answer read properly —
 * runs from `pnpm evals` with a key, against a baseline somebody records for
 * that model. Both use this harness; only one can be a required check.
 */
describe.skipIf(testDbUrl() === undefined)("the eval set", () => {
  it.effect("holds its baseline", () =>
    Effect.gen(function*() {
      const set = yield* readTestSet();
      const graded: Array<Graded> = [];

      for (const testCase of set.cases) {
        graded.push(
          grade(testCase, yield* observe(testCase, { model: layerScripted, pool: PgPoolTest })),
        );
      }

      const results = byCategory(graded);
      const baseline = readBaseline();
      const verdict = gate({
        model: "scripted",
        baseline,
        results,
        criticalFailures: graded
          .filter((row) => !row.passed && row.severity === "critical")
          .map((row) => row.id),
      });

      // The report is printed either way: a green run should still say what it
      // scored, or nobody notices the day a category quietly drops a case.
      // eslint-disable-next-line no-console
      console.log(markdown({ model: "scripted", results, graded, baseline, verdict }));

      expect(verdict.reasons).toEqual([]);
      expect(verdict.ok).toBe(true);
    }), 120_000);
});
