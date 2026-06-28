import { describe, expect, it } from "vitest";

import { calculateRoundNecklinePractice } from "./roundNecklinePractice";
import { buildRoundNecklinePracticeCalculationSummary } from "./roundNecklinePracticeCalculationSummary";

const DEFAULT_GAUGE = { stitchesPerFourInches: 28, rowsPerFourInches: 44 };

describe("buildRoundNecklinePracticeCalculationSummary", () => {
  it("documents that SVG and instructions use the same result object fields", () => {
    const result = calculateRoundNecklinePractice(DEFAULT_GAUGE)!;
    const summary = buildRoundNecklinePracticeCalculationSummary(result, DEFAULT_GAUGE);

    expect(summary).toContain("calculateRoundNecklinePractice()");
    expect(summary).toContain(`Cast on = ${result.castOnStitches}`);
    expect(summary).toContain(`HEIGHT = ${result.rowsBeforeNeckline}`);
    expect(summary).toContain(`DEPTH = ${result.neckDepthRows}`);
    expect(summary).toContain(result.worksheetSteps[0]!);
  });

  it("explains remaining rows after neckline shaping at default gauge (28/44)", () => {
    const result = calculateRoundNecklinePractice(DEFAULT_GAUGE)!;

    expect(result.neckShapingRows).toBe(14);
    expect(result.rowsRemainingAfterFinalNecklineShaping).toBe(19);
    expect(result.neckShapingRows + result.rowsRemainingAfterFinalNecklineShaping).toBe(
      result.neckDepthRows,
    );

    const summary = buildRoundNecklinePracticeCalculationSummary(result, DEFAULT_GAUGE);

    expect(summary).toContain(`Rows after final neckline shaping = ${result.rowsRemainingAfterFinalNecklineShaping}`);
    expect(summary).toContain(`${result.neckShapingRows} + ${result.rowsRemainingAfterFinalNecklineShaping} = ${result.neckDepthRows}`);
    expect(result.worksheetSteps.some((s) => s.includes(`Knit ${result.rowsRemainingAfterFinalNecklineShaping} rows even`))).toBe(
      true,
    );
  });
});
