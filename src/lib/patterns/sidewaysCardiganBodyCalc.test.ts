import { describe, expect, it } from "vitest";
import { evenPositiveBodyStitches, sleevelessBackHalfStitchesFromCircumference } from "./sleevelessBodyStitchMath";
import { inchesToRows } from "./sleevelessRowAccounting";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  armholeSlitsMatch,
  calculateSidewaysCardiganBody,
  frontsAreMirrored,
  garmentSectionIdentitiesHold,
  hasNoArmholeRowSections,
  neckSectionsMatch,
  sevenSectionsSumToActualBustRows,
  SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS,
  shoulderRowCountsMatch,
  sumBodyRowSections,
  type SidewaysCardiganBodyCalc,
  type SidewaysCardiganBodyCalcInput,
} from "./sidewaysCardiganBodyCalc";
import { buildSidewaysCardiganWorkspaceSummary } from "./sidewaysCardiganWorkspaceSummary";

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

/** Bust and neck divide evenly at the garment-section level: front 80, half-neck 32, shoulder 48. */
const EVEN_DIVIDE: SidewaysCardiganBodyCalcInput = {
  ...SAMPLE,
  neckOpeningWidthInches: 8,
  rowsPerInch: 8,
};

function calcOk(input: SidewaysCardiganBodyCalcInput = SAMPLE): SidewaysCardiganBodyCalc {
  const result = calculateSidewaysCardiganBody(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.calc;
}

describe("calculateSidewaysCardiganBody — rotated gauge", () => {
  const calc = calcOk();

  it("converts garment length with stitch gauge (not row gauge)", () => {
    expect(calc.garmentLengthStitches).toBe(
      evenPositiveBodyStitches(SAMPLE.garmentLengthInches * SAMPLE.stitchesPerInch),
    );
    expect(calc.garmentLengthStitches).not.toBe(
      inchesToRows(SAMPLE.garmentLengthInches, SAMPLE.rowsPerInch),
    );
  });

  it("converts V-neck depth with stitch gauge (not row gauge)", () => {
    expect(calc.vNeckDepthStitches).toBe(
      evenPositiveBodyStitches(SAMPLE.vNeckDepthInches * SAMPLE.stitchesPerInch),
    );
    expect(calc.vNeckDepthStitches).not.toBe(
      inchesToRows(SAMPLE.vNeckDepthInches, SAMPLE.rowsPerInch),
    );
  });

  it("converts requested bust circumference with row gauge (not stitch gauge)", () => {
    expect(calc.bust.requestedTotalBustRows).toBe(
      inchesToRows(SAMPLE.finishedBustCircumferenceInches, SAMPLE.rowsPerInch),
    );
    expect(calc.bust.requestedTotalBustRows).not.toBe(
      evenPositiveBodyStitches(SAMPLE.finishedBustCircumferenceInches * SAMPLE.stitchesPerInch),
    );
  });

  it("does not reuse bottom-up half-circumference body stitch math for bust", () => {
    const bottomUpHalf = sleevelessBackHalfStitchesFromCircumference(
      SAMPLE.finishedBustCircumferenceInches,
      SAMPLE.stitchesPerInch,
    );
    expect(calc.bust.requestedTotalBustRows).not.toBe(bottomUpHalf);
    expect(calc.garmentLengthStitches).not.toBe(bottomUpHalf);
  });
});

describe("calculateSidewaysCardiganBody — true drop-shoulder armhole slit", () => {
  const calc = calcOk();
  const depthInches = SAMPLE.finishedUpperArmInches / 2;

  it("calculates armhole depth in stitches, not rows", () => {
    const depthStitches = evenPositiveBodyStitches(depthInches * SAMPLE.stitchesPerInch);
    const depthAsRows = inchesToRows(depthInches, SAMPLE.rowsPerInch);
    expect(calc.armholeDepthStitches).toBe(depthStitches);
    expect(calc.armholeDepthStitches).not.toBe(depthAsRows);
    expect(depthStitches).not.toBe(depthAsRows);
  });

  it("uses half the finished upper-arm measurement for slit depth", () => {
    expect(computeDropShoulderArmholeDepthInches(SAMPLE.finishedUpperArmInches)).toBe(depthInches);
    expect(calc.armholeDepthInches).toBe(depthInches);
    expect(calc.armholeDepthInches).not.toBe(SAMPLE.finishedUpperArmInches);
    expect(calc.armholeDepthStitches).toBe(
      evenPositiveBodyStitches(depthInches * SAMPLE.stitchesPerInch),
    );
  });

  it("does not allocate full upper-arm as body rows", () => {
    const fullUpperArmRows = inchesToRows(SAMPLE.finishedUpperArmInches, SAMPLE.rowsPerInch);
    expect(calc.bust.actualTotalBustRows).not.toBe(fullUpperArmRows);
    expect(sumBodyRowSections(calc.bodyRowSequence)).not.toBe(
      sumBodyRowSections(calc.bodyRowSequence) + fullUpperArmRows,
    );
    expect(Object.keys(calc)).not.toContain("armholeOpeningRows");
    expect(Object.keys(calc)).not.toContain("firstArmholeOpeningRows");
    expect(Object.keys(calc)).not.toContain("secondArmholeOpeningRows");
  });

  it("has no armhole row sections — slits sit at side-seam boundaries", () => {
    expect(hasNoArmholeRowSections(calc)).toBe(true);
    expect(SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS).toHaveLength(7);
    expect(calc.armholeSlits.first.afterSection).toBe("firstFrontShoulder");
    expect(calc.armholeSlits.first.beforeSection).toBe("firstBackShoulder");
    expect(calc.armholeSlits.second.afterSection).toBe("secondBackShoulder");
    expect(calc.armholeSlits.second.beforeSection).toBe("secondFrontShoulder");
    expect(armholeSlitsMatch(calc)).toBe(true);
  });
});

describe("calculateSidewaysCardiganBody — 40/7/7 garment-section rows", () => {
  const calc = calcOk();

  it("uses the exact 40-inch bust, 7-inch neck, 7 RPI example", () => {
    expect(calc.frontRows).toBe(70);
    expect(calc.backRows).toBe(140);
    expect(calc.halfNeckRows).toBe(25);
    expect(calc.backNeckOpeningRows).toBe(50);
    expect(calc.shoulders.firstFrontRows).toBe(45);
    expect(calc.bust.actualTotalBustRows).toBe(280);
    expect(calc.bust.actualFinishedBustInches).toBe(40);
    expect(calc.bust.requestedTotalBustRows).toBe(280);
    expect(calc.bust.adjustmentRows).toBe(0);
  });

  it("keeps the required garment-section identities", () => {
    expect(garmentSectionIdentitiesHold(calc)).toBe(true);
    expect(calc.frontRows).toBe(calc.halfNeckRows + calc.shoulders.firstFrontRows);
    expect(calc.backRows).toBe(
      calc.shoulders.firstBackRows + calc.backNeckOpeningRows + calc.shoulders.secondBackRows,
    );
    expect(calc.backRows).toBe(2 * calc.frontRows);
    expect(calc.bust.actualTotalBustRows).toBe(2 * calc.backRows);
    expect(calc.backNeckOpeningRows).toBe(2 * calc.halfNeckRows);
  });

  it("assigns each front 70 rows / 10 inches and the back 140 rows / 20 inches", () => {
    const summary = buildSidewaysCardiganWorkspaceSummary({ calc, input: SAMPLE });
    expect(summary.rows.find((row) => row.term === "Each front")?.def).toBe("10 in · 70 rows");
    expect(summary.rows.find((row) => row.term === "Back")?.def).toBe("20 in · 140 rows");
    expect(summary.rows.find((row) => row.term === "Each V-neck section")?.def).toBe(
      "3.57 in · 25 rows",
    );
    expect(summary.rows.find((row) => row.term === "Each shoulder section")?.def).toBe(
      "6.43 in · 45 rows",
    );
    expect(summary.rows.find((row) => row.term === "Total bust rows")?.def).toBe("280 rows");
    expect(summary.rows.find((row) => row.term === "Actual finished bust")?.def).toBe("40 in");
    expect(summary.adjustmentMessage).toBeNull();
  });
});

describe("calculateSidewaysCardiganBody — seven-section bust rows", () => {
  it("keeps the two V sections identical and equal to half the back-neck", () => {
    const calc = calcOk();
    expect(neckSectionsMatch(calc)).toBe(true);
    expect(calc.bodyRowSequence.firstFrontVNeckShapingRows).toBe(calc.halfNeckRows);
    expect(calc.bodyRowSequence.secondFrontVNeckShapingRows).toBe(calc.halfNeckRows);
    expect(calc.bodyRowSequence.backNeckOpeningRows).toBe(2 * calc.halfNeckRows);
    expect(calc.fronts.first.vNeckShapingRows).toBe(calc.halfNeckRows);
    expect(calc.fronts.second.vNeckShapingRows).toBe(calc.halfNeckRows);
  });

  it("keeps all four shoulder sections identical", () => {
    const calc = calcOk();
    expect(shoulderRowCountsMatch(calc)).toBe(true);
    expect(calc.shoulders.firstFrontRows).toBe(calc.shoulders.firstBackRows);
    expect(calc.shoulders.firstBackRows).toBe(calc.shoulders.secondBackRows);
    expect(calc.shoulders.secondBackRows).toBe(calc.shoulders.secondFrontRows);
    expect(calc.shoulders.firstFrontRows).toBeGreaterThan(0);
  });

  it("adds the seven sections to the actual total bust rows", () => {
    const calc = calcOk();
    expect(sevenSectionsSumToActualBustRows(calc)).toBe(true);
    expect(sumBodyRowSections(calc.bodyRowSequence)).toBe(calc.bust.actualTotalBustRows);
    expect(calc.bust.actualTotalBustRows).toBe(4 * calc.frontRows);
  });

  it("keeps both fronts mirrored", () => {
    const calc = calcOk();
    expect(frontsAreMirrored(calc)).toBe(true);
    expect(calc.fronts.first).toEqual(calc.fronts.second);
    expect(calc.bodyRowSequence.firstFrontVNeckShapingRows).toBe(
      calc.bodyRowSequence.secondFrontVNeckShapingRows,
    );
    expect(calc.bodyRowSequence.firstFrontShoulderRows).toBe(
      calc.bodyRowSequence.secondFrontShoulderRows,
    );
  });

  it("keeps the two V sections identical when the raw full-neck row result is odd", () => {
    const oddNeck = calcOk({
      ...SAMPLE,
      finishedBustCircumferenceInches: 36,
      neckOpeningWidthInches: 5,
    });
    const rawFullNeck = inchesToRows(5, 7);
    expect(rawFullNeck).toBe(35);
    expect(rawFullNeck % 2).toBe(1);
    expect(oddNeck.neckOpeningRows).toBe(35);
    expect(oddNeck.halfNeckRows).toBe(18);
    expect(oddNeck.bodyRowSequence.firstFrontVNeckShapingRows).toBe(18);
    expect(oddNeck.bodyRowSequence.secondFrontVNeckShapingRows).toBe(18);
    expect(oddNeck.backNeckOpeningRows).toBe(36);
    expect(oddNeck.backNeckOpeningRows % 2).toBe(0);
    expect(
      oddNeck.bodyRowSequence.firstFrontVNeckShapingRows +
        oddNeck.bodyRowSequence.secondFrontVNeckShapingRows,
    ).toBe(oddNeck.backNeckOpeningRows);
    expect(neckSectionsMatch(oddNeck)).toBe(true);
    expect(garmentSectionIdentitiesHold(oddNeck)).toBe(true);
  });

  it("reports a bust-row adjustment when 4 × frontRows differs from the requested circumference", () => {
    const calc = calcOk({
      ...SAMPLE,
      finishedBustCircumferenceInches: 41,
    });
    expect(calc.frontRows).toBe(72);
    expect(calc.bust.requestedTotalBustRows).toBe(287);
    expect(calc.bust.actualTotalBustRows).toBe(288);
    expect(calc.bust.adjustmentRows).toBe(1);
    expect(calc.bust.adjustmentInches).toBeCloseTo(1 / 7, 10);
    expect(calc.bust.actualFinishedBustInches).toBeCloseTo(288 / 7, 10);
    expect(shoulderRowCountsMatch(calc)).toBe(true);
    expect(neckSectionsMatch(calc)).toBe(true);
    expect(garmentSectionIdentitiesHold(calc)).toBe(true);
  });

  it("reports zero bust adjustment when the garment-section rows already match the requested bust", () => {
    const calc = calcOk(EVEN_DIVIDE);
    expect(calc.bust.requestedTotalBustRows).toBe(320);
    expect(calc.frontRows).toBe(80);
    expect(calc.halfNeckRows).toBe(32);
    expect(calc.shoulders.firstFrontRows).toBe(48);
    expect(calc.backNeckOpeningRows).toBe(64);
    expect(calc.bust.actualTotalBustRows).toBe(320);
    expect(calc.bust.adjustmentRows).toBe(0);
    expect(calc.bust.adjustmentInches).toBe(0);
    expect(sevenSectionsSumToActualBustRows(calc)).toBe(true);
    expect(shoulderRowCountsMatch(calc)).toBe(true);
    expect(neckSectionsMatch(calc)).toBe(true);
    expect(frontsAreMirrored(calc)).toBe(true);
    expect(garmentSectionIdentitiesHold(calc)).toBe(true);
  });

  it("rejects combinations that leave zero or negative shoulder rows", () => {
    const zeroShoulders = calculateSidewaysCardiganBody({
      ...SAMPLE,
      finishedBustCircumferenceInches: 20,
      neckOpeningWidthInches: 10,
      rowsPerInch: 7,
    });
    expect(zeroShoulders.ok).toBe(false);
    if (zeroShoulders.ok) throw new Error("expected validation error");
    expect(zeroShoulders.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS);
    expect(zeroShoulders.error.frontRows).toBe(35);
    expect(zeroShoulders.error.halfNeckRows).toBe(35);
    expect(zeroShoulders.error.roundedShoulderRows).toBe(0);
    expect(zeroShoulders.error.remainingRowsForShoulders).toBe(0);
    expect(zeroShoulders.error.message).toMatch(/shoulder/i);

    const justPositive = calculateSidewaysCardiganBody({
      ...SAMPLE,
      finishedBustCircumferenceInches: 20,
      neckOpeningWidthInches: 9.8,
      rowsPerInch: 7,
    });
    expect(justPositive.ok).toBe(true);
    if (!justPositive.ok) throw new Error(justPositive.error.message);
    expect(justPositive.calc.frontRows).toBe(35);
    expect(justPositive.calc.halfNeckRows).toBe(34);
    expect(justPositive.calc.shoulders.firstFrontRows).toBe(1);

    const negativeShoulders = calculateSidewaysCardiganBody({
      ...SAMPLE,
      finishedBustCircumferenceInches: 20,
      neckOpeningWidthInches: 12,
      rowsPerInch: 7,
    });
    expect(negativeShoulders.ok).toBe(false);
    if (negativeShoulders.ok) throw new Error("expected validation error");
    expect(negativeShoulders.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS);
    expect(negativeShoulders.error.frontRows).toBe(35);
    expect(negativeShoulders.error.halfNeckRows).toBe(42);
    expect(negativeShoulders.error.roundedShoulderRows).toBeLessThan(0);
    expect(negativeShoulders.error.remainingRowsForShoulders).toBeLessThan(0);
  });
});
