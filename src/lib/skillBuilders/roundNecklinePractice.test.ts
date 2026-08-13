import { describe, expect, it } from "vitest";

import {
  adjustNecklineStitchesForEvenShoulders,
  calculateRoundNecklinePractice,
  ROUND_NECKLINE_PRACTICE_DEFAULTS,
  rowsPerInchFromGauge,
  stitchesPerInchFromGauge,
} from "./roundNecklinePractice";

describe("roundNecklinePractice gauge helpers", () => {
  it("converts stitches and rows per 4 inches to per inch", () => {
    expect(stitchesPerInchFromGauge(28)).toBe(7);
    expect(rowsPerInchFromGauge(44)).toBe(11);
    expect(stitchesPerInchFromGauge(0)).toBe(0);
  });
});

describe("adjustNecklineStitchesForEvenShoulders", () => {
  it("bumps neck width by 1 when shoulders would not divide evenly", () => {
    expect(adjustNecklineStitchesForEvenShoulders(98, 35)).toBe(36);
    expect(adjustNecklineStitchesForEvenShoulders(98, 36)).toBe(36);
  });
});

describe("calculateRoundNecklinePractice", () => {
  const DEFAULT_GAUGE = { stitchesPerFourInches: 28, rowsPerFourInches: 44 };

  function practiceResult() {
    return calculateRoundNecklinePractice(DEFAULT_GAUGE)!;
  }

  it("returns null when gauge is invalid", () => {
    expect(calculateRoundNecklinePractice({ stitchesPerFourInches: 0, rowsPerFourInches: 44 })).toBeNull();
    expect(calculateRoundNecklinePractice({ stitchesPerFourInches: 28, rowsPerFourInches: -1 })).toBeNull();
  });

  it("uses default practice dimensions at standard gauge (28 sts / 44 rows per 4 inches)", () => {
    const result = practiceResult();

    expect(result.castOnStitches).toBe(98);
    expect(result.rowsBeforeNeckline).toBe(33);
    expect(result.neckDepthRows).toBe(33);
    expect(result.totalRows).toBe(66);
    expect(result.neckOpeningStitches).toBe(36);
    expect(result.leftShoulderStitches).toBe(31);
    expect(result.rightShoulderStitches).toBe(31);
    expect(result.centerBindOffStitches).toBe(12);
    expect(result.oneSideStartingStitches).toBe(43);
    expect(result.oppositeSideStitches).toBe(43);
    expect(result.dimensions).toEqual({
      ...ROUND_NECKLINE_PRACTICE_DEFAULTS,
      finishedHeightInches: 6,
    });
    expect(result.neckPlan.totalCheck).toBe(36);
  });

  it("keeps row math explicit and consistent", () => {
    const result = practiceResult();

    expect(result.rowsBeforeNeckline + result.neckDepthRows).toBe(result.totalRows);
    expect(result.neckShapingRows + result.rowsRemainingAfterFinalNecklineShaping).toBe(
      result.neckDepthRows,
    );
    expect(result.rowsRemainingAfterFinalNecklineShaping).toBe(
      result.neckDepthRows - result.neckShapingRows,
    );
  });

  it("keeps stitch math explicit and consistent", () => {
    const result = practiceResult();

    expect(
      result.leftShoulderStitches + result.neckOpeningStitches + result.rightShoulderStitches,
    ).toBe(result.castOnStitches);
  });

  it("builds worksheet steps from the shared result values", () => {
    const result = practiceResult();

    expect(result.worksheetSteps).toHaveLength(8);
    expect(result.worksheetSteps[0]).toBe("Cast on 98 stitches.");
    expect(result.worksheetSteps[1]).toBe("Knit 33 rows even.");
    expect(result.worksheetSteps[2]).toBe("Bind off the center 12 stitches.");
    expect(result.worksheetSteps[3]).toBe(
      "Work one side of the neckline (43 stitches on hold on the other side).",
    );
    expect(result.worksheetSteps[4]).toMatch(/Shape the neck edge:/);
    expect(result.worksheetSteps[5]).toBe("Knit 19 rows even to the shoulder.");
    expect(result.worksheetSteps[6]).toBe("Bind off 31 shoulder stitches.");
    expect(result.worksheetSteps[7]).toBe("Repeat for the second side, reversing the shaping.");

    const joined = result.worksheetSteps.join(" ");
    expect(joined).not.toMatch(/armhole|shoulder shaping|sleeveless/i);
  });

  it("includes a shaping chart with cast-on, even, bind-off, and neck shaping rows", () => {
    const result = practiceResult();

    expect(result.shapingChart.length).toBeGreaterThanOrEqual(5);
    expect(result.shapingChart[0]?.step).toBe("Cast on");
    expect(result.shapingChart.at(-1)?.step).toBe("Bind off shoulder");
  });

  it("populates SVG placeholders from the same result object", () => {
    const result = practiceResult();

    expect(result.svgPlaceholders.HEIGHT).toBe(result.rowsBeforeNeckline);
    expect(result.svgPlaceholders.HEIGHT_TOTAL).toBe(result.totalRows);
    expect(result.svgPlaceholders.DEPTH).toBe(result.neckDepthRows);
    expect(result.svgPlaceholders["cast-on"]).toBe(result.castOnStitches);
    expect(result.svgPlaceholders.NECK_STS).toBe(result.neckOpeningStitches);
    expect(result.svgPlaceholders.SHOULDER_BINDOFF_STS).toBe(result.leftShoulderStitches);
    expect(result.svgPlaceholders["JP-SHAPING"]).toBe(result.japaneseNotationLines.join("\n"));
    expect(result.svgPlaceholders.JP_LINE1).toBe(result.japaneseNotationLines[0]);
  });
});
