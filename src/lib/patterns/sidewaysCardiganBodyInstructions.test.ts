import { describe, expect, it } from "vitest";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { distributeTotalAcrossRows } from "./distributeTotalAcrossRows";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH,
  SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES,
} from "./sidewaysCardiganBodyInstructions";
import { SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

function instructionsOk(input: SidewaysCardiganBodyCalcInput = SAMPLE) {
  const result = buildSidewaysCardiganBodyInstructions(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

describe("sideways cardigan body instruction model", () => {
  const instructions = instructionsOk();
  const { calc, firstV, secondV, landmarks, sectionRowCounts, steps } = instructions;

  it("sets starting stitches to garment length minus V-neck depth", () => {
    expect(instructions.startingFrontStitches).toBe(
      calc.garmentLengthStitches - calc.vNeckDepthStitches,
    );
    expect(instructions.startingFrontStitches).toBe(
      evenPositiveBodyStitches(22 * 5) - evenPositiveBodyStitches(8 * 5),
    );
    expect(instructions.startingFrontStitches).toBe(70);
  });

  it("adds exactly the V-neck-depth stitches on the first V", () => {
    const added = firstV.stitchesChangedOnRow.reduce((sum, n) => sum + n, 0);
    expect(added).toBe(calc.vNeckDepthStitches);
    expect(firstV.stitchesChangedOnRow).toEqual(
      distributeTotalAcrossRows(calc.vNeckDepthStitches, calc.neckOpeningRows),
    );
  });

  it("finishes the first V at full garment-length stitches", () => {
    expect(firstV.startStitches).toBe(instructions.startingFrontStitches);
    expect(firstV.endStitches).toBe(calc.garmentLengthStitches);
    expect(firstV.stitchesAfterRow.at(-1)).toBe(calc.garmentLengthStitches);
    expect(firstV.rows).toBe(calc.neckOpeningRows);
  });

  it("keeps the four shoulder sections at identical row counts", () => {
    expect(sectionRowCounts.firstFrontShoulder).toBe(sectionRowCounts.firstBackShoulder);
    expect(sectionRowCounts.firstBackShoulder).toBe(sectionRowCounts.secondBackShoulder);
    expect(sectionRowCounts.secondBackShoulder).toBe(sectionRowCounts.secondFrontShoulder);
    expect(sectionRowCounts.firstFrontShoulder).toBe(calc.shoulders.firstFrontRows);
  });

  it("uses stitch bind-off/cast-on for armholes and adds no armhole rows", () => {
    const firstSlit = steps.find((s) => s.id === "first-armhole-slit");
    const secondSlit = steps.find((s) => s.id === "second-armhole-slit");
    expect(firstSlit?.rows).toBe(0);
    expect(secondSlit?.rows).toBe(0);
    expect(firstSlit?.summary).toContain(String(calc.armholeDepthStitches));
    expect(secondSlit?.summary).toContain(String(calc.armholeDepthStitches));
    expect(firstSlit?.stitchesBefore).toBe(calc.garmentLengthStitches);
    expect(firstSlit?.stitchesAfter).toBe(calc.garmentLengthStitches);
    expect(landmarks.firstBackNeckEdge - landmarks.firstSideSeam).toBe(
      sectionRowCounts.firstBackShoulder,
    );
    expect(steps.some((s) => /armhole row/i.test(s.summary))).toBe(false);
  });

  it("matches back-neck bind-off and cast-on stitch counts", () => {
    const bindOff = steps.find((s) => s.id === "bind-off-back-neck");
    const castOn = steps.find((s) => s.id === "cast-on-back-neck");
    expect(bindOff?.rows).toBe(0);
    expect(castOn?.rows).toBe(0);
    expect(calc.backNeckDepthStitches).toBe(evenPositiveBodyStitches(1 * 5));
    expect(bindOff?.stitchesBefore).toBe(calc.garmentLengthStitches);
    expect(bindOff?.stitchesAfter).toBe(instructions.backNeckLiveStitches);
    expect(castOn?.stitchesBefore).toBe(instructions.backNeckLiveStitches);
    expect(castOn?.stitchesAfter).toBe(calc.garmentLengthStitches);
    expect(bindOff?.summary).toContain(String(calc.backNeckDepthStitches));
    expect(castOn?.summary).toContain(String(calc.backNeckDepthStitches));
  });

  it("uses the established neck-opening rows for the straight back neck", () => {
    const opening = steps.find((s) => s.id === "back-neck-opening");
    expect(opening?.rows).toBe(calc.neckOpeningRows);
    expect(sectionRowCounts.backNeckOpening).toBe(calc.neckOpeningRows);
    expect(opening?.stitchesAfter).toBe(instructions.backNeckLiveStitches);
  });

  it("makes the second V an exact reverse of the first", () => {
    expect(secondV.stitchesChangedOnRow).toEqual([...firstV.stitchesChangedOnRow].reverse());
    expect(secondV.startStitches).toBe(firstV.endStitches);
    expect(secondV.endStitches).toBe(firstV.startStitches);
    expect(secondV.rows).toBe(firstV.rows);
    const removed = secondV.stitchesChangedOnRow.reduce((sum, n) => sum + n, 0);
    expect(removed).toBe(calc.vNeckDepthStitches);
  });

  it("ends the second V at the starting-front stitch count", () => {
    expect(secondV.endStitches).toBe(instructions.startingFrontStitches);
    expect(secondV.stitchesAfterRow.at(-1)).toBe(instructions.startingFrontStitches);
    const finalBindOff = steps.find((s) => s.id === "bind-off-starting-front");
    expect(finalBindOff?.stitchesBefore).toBe(instructions.startingFrontStitches);
    expect(finalBindOff?.stitchesAfter).toBe(0);
  });

  it("locks the representative SAMPLE stitch counts, landmarks, and section rows", () => {
    expect(calc.garmentLengthStitches).toBe(110);
    expect(calc.vNeckDepthStitches).toBe(40);
    expect(instructions.startingFrontStitches).toBe(70);
    expect(calc.backNeckDepthStitches).toBe(6);
    expect(calc.armholeDepthStitches).toBe(36);
    expect(calc.neckOpeningRows).toBe(49);
    expect(calc.shoulders.firstFrontRows).toBe(33);
    expect(calc.bust.actualTotalBustRows).toBe(279);
    expect(sectionRowCounts).toEqual({
      firstVNeck: 49,
      firstFrontShoulder: 33,
      firstBackShoulder: 33,
      backNeckOpening: 49,
      secondBackShoulder: 33,
      secondFrontShoulder: 33,
      secondVNeck: 49,
    });
    expect(landmarks).toEqual({
      endFirstVShaping: 49,
      firstSideSeam: 82,
      firstBackNeckEdge: 115,
      secondBackNeckEdge: 164,
      secondSideSeam: 197,
      startFinalVShaping: 230,
      finalBindOff: 279,
    });
  });

  it("accounts for every actual bust row in the body sections", () => {
    const stepRows = steps.reduce((sum, s) => sum + s.rows, 0);
    const sectionRows =
      sectionRowCounts.firstVNeck +
      sectionRowCounts.firstFrontShoulder +
      sectionRowCounts.firstBackShoulder +
      sectionRowCounts.backNeckOpening +
      sectionRowCounts.secondBackShoulder +
      sectionRowCounts.secondFrontShoulder +
      sectionRowCounts.secondVNeck;
    expect(stepRows).toBe(calc.bust.actualTotalBustRows);
    expect(sectionRows).toBe(calc.bust.actualTotalBustRows);
    expect(landmarks.finalBindOff).toBe(calc.bust.actualTotalBustRows);
    expect(steps).toHaveLength(13);
  });

  it("rejects impossible measurement combinations with a clear error", () => {
    const starting = buildSidewaysCardiganBodyInstructions({
      ...SAMPLE,
      vNeckDepthInches: 22,
    });
    expect(starting.ok).toBe(false);
    if (starting.ok) throw new Error("expected starting-stitch error");
    expect(starting.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES);

    const noBackNeck = buildSidewaysCardiganBodyInstructions({
      ...SAMPLE,
      backNeckDepthInches: 0,
    });
    expect(noBackNeck.ok).toBe(false);
    if (noBackNeck.ok) throw new Error("expected back-neck error");
    expect(noBackNeck.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES);

    const deepBackNeck = buildSidewaysCardiganBodyInstructions({
      ...SAMPLE,
      backNeckDepthInches: 30,
    });
    expect(deepBackNeck.ok).toBe(false);
    if (deepBackNeck.ok) throw new Error("expected back-neck length error");
    expect(deepBackNeck.error.code).toBe(SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH);

    const deepArmhole = buildSidewaysCardiganBodyInstructions({
      ...SAMPLE,
      finishedUpperArmInches: 60,
    });
    expect(deepArmhole.ok).toBe(false);
    if (deepArmhole.ok) throw new Error("expected armhole error");
    expect(deepArmhole.error.code).toBe(SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH);

    const noShoulders = buildSidewaysCardiganBodyInstructions({
      ...SAMPLE,
      finishedBustCircumferenceInches: 20,
      neckOpeningWidthInches: 10,
    });
    expect(noShoulders.ok).toBe(false);
    if (noShoulders.ok) throw new Error("expected shoulder error");
    expect(noShoulders.error.code).toBe(SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS);
  });
});

describe("sideways cardigan back-neck depth in the body calc", () => {
  it("converts back-neck depth with stitch gauge using even-positive rounding", () => {
    const result = calculateSidewaysCardiganBody(SAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.calc.backNeckDepthStitches).toBe(evenPositiveBodyStitches(1 * 5));
    expect(result.calc.backNeckDepthStitches).toBe(6);
  });
});
