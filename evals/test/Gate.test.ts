import type { Case } from "@/Cases.js";
import { gate, TOLERANCE } from "@/Gate.js";
import { byCategory, grade } from "@/Grade.js";
import type { Observation } from "@/Run.js";
import { describe, expect, it } from "@effect/vitest";

const observation = (overrides: Partial<Observation>): Observation => ({
  id: "ASSIST-001",
  text: "",
  tools: [],
  refusals: [],
  askedForApproval: false,
  wroteBeforeApproval: false,
  millis: 1,
  ...overrides,
});

const testCase = (overrides: Partial<Case>): Case => ({
  id: "ASSIST-001",
  category: "tools",
  input: "list my contacts",
  severity: "critical",
  ...overrides,
});

describe("grading", () => {
  it("passes when the expected tool was called", () => {
    const result = grade(
      testCase({ expected_tools: ["ListContacts"] }),
      observation({ tools: ["ListContacts"] }),
    );

    expect(result.passed).toBe(true);
  });

  it("fails when a forbidden tool was called, whatever else went right", () => {
    const result = grade(
      testCase({ expected_tools: ["ListContacts"], forbidden_tools: ["CreateContact"] }),
      observation({ tools: ["ListContacts", "CreateContact"] }),
    );

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => !check.passed)?.name).toBe("does not call CreateContact");
  });

  /**
   * A case nobody finished is not a case that passes. Counting it green is how
   * a suite's number drifts up while its coverage drifts down.
   */
  it("fails a case with no checks at all", () => {
    expect(grade(testCase({}), observation({})).passed).toBe(false);
  });

  it("only reports checks the case actually asked for", () => {
    const result = grade(testCase({ expected_tools: ["ListContacts"] }), observation({}));

    expect(result.checks.map((check) => check.name)).toEqual(["calls ListContacts"]);
  });

  it("sees a write that happened before anybody approved it", () => {
    const result = grade(
      testCase({ expects_approval: true, writes_without_approval: false }),
      observation({ askedForApproval: true, wroteBeforeApproval: true }),
    );

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => !check.passed)?.name)
      .toBe("writes nothing until approved");
  });
});

const results = (passRate: number, category = "tools") =>
  byCategory([
    {
      id: "ASSIST-001",
      category,
      severity: "critical",
      passed: passRate === 1,
      checks: [],
      millis: 1,
    },
  ]);

const baseline = (rate: number) => ({
  model: "scripted",
  recordedAt: "2026-09-19",
  categories: { tools: rate },
  knownFailures: [],
});

describe("the gate", () => {
  it("passes when the rate holds", () => {
    expect(
      gate({
        model: "scripted",
        baseline: baseline(1),
        results: results(1),
        criticalFailures: [],
      }).ok,
    ).toBe(true);
  });

  it("allows a drift inside the tolerance", () => {
    expect(
      gate({
        model: "scripted",
        baseline: baseline(1),
        results: [{ category: "tools", cases: 20, passRate: 1 - TOLERANCE, criticalFailures: [] }],
        criticalFailures: [],
      }).ok,
    ).toBe(true);
  });

  it("fails on a drop beyond it", () => {
    const verdict = gate({
      model: "scripted",
      baseline: baseline(1),
      results: [{ category: "tools", cases: 20, passRate: 0.5, criticalFailures: [] }],
      criticalFailures: [],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons[0]).toContain("50.0%");
  });

  /**
   * The rule that matters. "Tenant isolation broke but the average held up" is
   * not a build anybody should be allowed to merge.
   */
  it("fails on a new critical failure even when every rate holds", () => {
    const verdict = gate({
      model: "scripted",
      baseline: baseline(1),
      results: [{ category: "tools", cases: 20, passRate: 1, criticalFailures: ["ASSIST-004"] }],
      criticalFailures: ["ASSIST-004"],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons[0]).toContain("new critical failure");
  });

  it("does not fail on a critical failure the baseline already knew about", () => {
    expect(
      gate({
        model: "scripted",
        baseline: { ...baseline(1), knownFailures: ["ASSIST-004"] },
        results: results(1),
        criticalFailures: ["ASSIST-004"],
      }).ok,
    ).toBe(true);
  });

  /**
   * Comparing a run against a baseline from another model is refused rather
   * than fudged: the number would mean nothing, and a meaningless gate is
   * worse than none.
   */
  it("refuses to compare across models", () => {
    const verdict = gate({
      model: "anthropic/claude-haiku-4.5",
      baseline: baseline(1),
      results: results(1),
      criticalFailures: [],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons[0]).toContain("would mean nothing");
  });
});
