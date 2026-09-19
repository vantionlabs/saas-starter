import type { CategoryResult } from "./Grade.js";

export type Baseline = {
  /** What answered when this was recorded. A score without it means nothing. */
  readonly model: string;
  readonly recordedAt: string;
  readonly categories: Record<string, number>;
  /** Cases that were already failing when it was recorded. */
  readonly knownFailures: ReadonlyArray<string>;
};

/** How far a pass rate may drop before the build fails. */
export const TOLERANCE = 0.05;

export type Verdict = {
  readonly ok: boolean;
  readonly reasons: ReadonlyArray<string>;
};

/**
 * The gate.
 *
 * Two rules, and the second is the one that matters. A pass rate may drift
 * down by the tolerance — models are not deterministic and a suite that fails
 * on noise gets switched off. A **new** critical failure fails immediately
 * whatever the rate says, because "tenant isolation broke but the average held
 * up" is not a build anybody should be allowed to merge.
 *
 * Comparing a run against a baseline recorded from a different model is
 * refused rather than fudged: the number would be meaningless, and a
 * meaningless gate is worse than none.
 */
export const gate = (options: {
  readonly model: string;
  readonly baseline: Baseline;
  readonly results: ReadonlyArray<CategoryResult>;
  readonly criticalFailures: ReadonlyArray<string>;
}): Verdict => {
  const reasons: Array<string> = [];

  if (options.baseline.model !== options.model) {
    return {
      ok: false,
      reasons: [
        `the baseline was recorded against \`${options.baseline.model}\` and this run used `
        + `\`${options.model}\`. Re-record it, or run against the same model — comparing the two `
        + `numbers would mean nothing.`,
      ],
    };
  }

  for (const result of options.results) {
    const before = options.baseline.categories[result.category];

    if (before === undefined) continue;

    if (result.passRate < before - TOLERANCE) {
      reasons.push(
        `${result.category}: ${percent(result.passRate)} against a baseline of ${percent(before)}`,
      );
    }
  }

  for (const id of options.criticalFailures) {
    if (options.baseline.knownFailures.includes(id)) continue;

    reasons.push(`${id} is a new critical failure`);
  }

  return { ok: reasons.length === 0, reasons };
};

export const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;
