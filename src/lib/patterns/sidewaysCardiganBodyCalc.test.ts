import { describe, expect, it } from "vitest";
import { evenPositiveBodyStitches, sleevelessBackHalfStitchesFromCircumference } from "./sleevelessBodyStitchMath";
import { inchesToRows } from "./sleevelessRowAccounting";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  armholeSlitsMatch,
  calculateSidewaysCardiganBody,
  frontsAreMirrored,
  hasNoArmholeRowSections,
  sevenSectionsSumToActualBustRows,
  SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS,
  shoulderRowCountsMatch,
  sumBodyRowSections,
  threeNeckSectionsMatch,
  type SidewaysCardiganBodyCalc,
  type SidewaysCardiganBodyCalcInput,
} from "./sidewaysCardiganBodyCalc";

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

/** Bust and neck divide evenly: 40 in × 8 rpi = 320; neck 8 in × 8 = 64; 320 = 3×64 + 4×32. */
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

describe("calculateSidewaysCardiganBody — seven-section bust rows", () => {
  it("keeps all three neck sections identical", () => {
    const calc = calcOk();
    const neck = inchesToRows(SAMPLE.neckOpeningWidthInches, SAMPLE.rowsPerInch);
    expect(threeNeckSectionsMatch(calc)).toBe(true);
    expect(calc.bodyRowSequence.firstFrontVNeckShapingRows).toBe(neck);
    expect(calc.bodyRowSequence.backNeckOpeningRows).toBe(neck);
    expect(calc.bodyRowSequence.secondFrontVNeckShapingRows).toBe(neck);
    expect(calc.fronts.first.vNeckShapingRows).toBe(neck);
    expect(calc.fronts.second.vNeckShapingRows).toBe(neck);
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
    expect(calc.bust.actualTotalBustRows).toBe(
      3 * calc.neckOpeningRows + 4 * calc.shoulders.firstFrontRows,
    );
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

  it("does not distribute leftover rows unevenly when bust rows do not divide cleanly", () => {
    const calc = calcOk();
    const requested = inchesToRows(SAMPLE.finishedBustCircumferenceInches, SAMPLE.rowsPerInch);
    const neck = inchesToRows(SAMPLE.neckOpeningWidthInches, SAMPLE.rowsPerInch);
    const remaining = requested - 3 * neck;
    expect(remaining % 4).not.toBe(0);
    const shoulder = Math.round(remaining / 4);
    expect(calc.shoulders.firstFrontRows).toBe(shoulder);
    expect(calc.shoulders.firstBackRows).toBe(shoulder);
    expect(calc.shoulders.secondBackRows).toBe(shoulder);
    expect(calc.shoulders.secondFrontRows).toBe(shoulder);
    expect(calc.bust.actualTotalBustRows).toBe(3 * neck + 4 * shoulder);
    expect(calc.bust.actualTotalBustRows).not.toBe(requested);
    expect(calc.bust.adjustmentRows).toBe(calc.bust.actualTotalBustRows - requested);
    expect(calc.bust.adjustmentInches).toBe(calc.bust.adjustmentRows / SAMPLE.rowsPerInch);
    expect(calc.bust.requestedFinishedBustInches).toBe(SAMPLE.finishedBustCircumferenceInches);
    expect(calc.bust.actualFinishedBustInches).toBe(
      calc.bust.actualTotalBustRows / SAMPLE.rowsPerInch,
    );
  });

  it("reports zero bust adjustment when the row counts already divide symmetrically", () => {
    const calc = calcOk(EVEN_DIVIDE);
    expect(calc.bust.requestedTotalBustRows).toBe(320);
    expect(calc.neckOpeningRows).toBe(64);
    expect(calc.shoulders.firstFrontRows).toBe(32);
    expect(calc.bust.actualTotalBustRows).toBe(320);
    expect(calc.bust.adjustmentRows).toBe(0);
    expect(calc.bust.adjustmentInches).toBe(0);
    expect(sevenSectionsSumToActualBustRows(calc)).toBe(true);
    expect(shoulderRowCountsMatch(calc)).toBe(true);
    expect(threeNeckSectionsMatch(calc)).toBe(true);
    expect(frontsAreMirrored(calc)).toBe(true);
  });

  it("rejects combinations that leave zero or negative shoulder rows", () => {
    const zeroShoulders = calculateSidewaysCardiganBody({
      ...SAMPLE,
      finishedBustCircumferenceInches: 21,
      neckOpeningWidthInches: 7,
      rowsPerInch: 1,
    });
    expect(zeroShoulders.ok).toBe(false);
    if (zeroShoulders.ok) throw new Error("expected validation error");
    expect(zeroShoulders.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS);
    expect(zeroShoulders.error.roundedShoulderRows).toBe(0);
    expect(zeroShoulders.error.message).toMatch(/shoulder/i);

    const negativeShoulders = calculateSidewaysCardiganBody({
      ...SAMPLE,
      finishedBustCircumferenceInches: 20,
      neckOpeningWidthInches: 10,
      rowsPerInch: 7,
    });
    expect(negativeShoulders.ok).toBe(false);
    if (negativeShoulders.ok) throw new Error("expected validation error");
    expect(negativeShoulders.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS);
    expect(negativeShoulders.error.roundedShoulderRows).toBeLessThan(0);
    expect(negativeShoulders.error.remainingRowsForShoulders).toBeLessThan(0);
  });
});
