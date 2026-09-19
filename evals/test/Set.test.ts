import { readBaseline, readTestSet } from "@/Suite.js";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

/**
 * The set itself, checked the way a test set should be.
 *
 * These run everywhere, with no database and no model: a malformed case, a
 * reused id or a baseline recorded against a model nobody named are all
 * problems with the *suite*, and finding them needs nothing to be running.
 */
describe("the test set", () => {
  it.effect("parses, and every case is complete", () =>
    Effect.gen(function*() {
      const set = yield* readTestSet();

      expect(set.cases.length).toBeGreaterThan(0);

      for (const testCase of set.cases) {
        expect(testCase.id, "a case with no id").not.toBe("");
        expect(
          testCase.expected_behaviour,
          `${testCase.id} says nothing about what good looks like`,
        ).toBeDefined();
      }
    }));

  it.effect("never reuses an id, because runs are compared by them", () =>
    Effect.gen(function*() {
      const set = yield* readTestSet();
      const ids = set.cases.map((testCase) => testCase.id);

      expect(new Set(ids).size).toBe(ids.length);
    }));

  it.effect("gives every case something to check", () =>
    Effect.gen(function*() {
      const set = yield* readTestSet();

      for (const testCase of set.cases) {
        const checkable = testCase.expected_tools !== undefined
          || testCase.forbidden_tools !== undefined
          || testCase.must_include !== undefined
          || testCase.must_not_include !== undefined
          || testCase.expects_approval !== undefined
          || testCase.expects_refusal !== undefined;

        expect(checkable, `${testCase.id} has no check, so it can never fail`).toBe(true);
      }
    }));

  it("records which model the baseline came from", () => {
    const baseline = readBaseline();

    expect(baseline.model, "a score with no model attached means nothing").not.toBe("");
    expect(baseline.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
