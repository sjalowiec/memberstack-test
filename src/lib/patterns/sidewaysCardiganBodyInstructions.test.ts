import { describe, expect, it } from "vitest";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  knittedArmholeSlitCount,
  renderSidewaysCardiganBodySequenceHtml,
  SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH,
  SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES,
  SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES,
  SIDEWAYS_CARDIGAN_V_NECK_NOT_SLOPE,
  SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE,
  sidewaysVNeckShapingActions,
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

const SAMPLE_INCREASE_SEQUENCE = [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
const SAMPLE_DECREASE_SEQUENCE = [...SAMPLE_INCREASE_SEQUENCE].reverse();

function instructionsOk(input: SidewaysCardiganBodyCalcInput = SAMPLE) {
  const result = buildSidewaysCardiganBodyInstructions(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

describe("sideways cardigan body instruction model", () => {
  const instructions = instructionsOk();
  const { calc, firstV, secondV, landmarks, sectionRowCounts, steps } = instructions;

  it("sets starting working stitches to garment length minus V-neck depth", () => {
    expect(instructions.startingFrontStitches).toBe(
      calc.garmentLengthStitches - calc.vNeckDepthStitches,
    );
    expect(instructions.startingFrontStitches).toBe(
      evenPositiveBodyStitches(22 * 5) - evenPositiveBodyStitches(8 * 5),
    );
    expect(instructions.startingFrontStitches).toBe(70);
  });

  it("uses calculateSlopeShaping for the first V and the reverse sequence for the second", () => {
    const slope = calculateSlopeShaping(calc.vNeckDepthStitches, calc.halfNeckRows);
    expect(slope.ok).toBe(true);
    if (!slope.ok) throw new Error(slope.reason);
    expect(slope.shapingActions).toBe(13);
    expect(slope.rowInterval).toBe(2);
    expect(slope.sequence).toEqual(SAMPLE_INCREASE_SEQUENCE);
    expect(instructions.increaseSequence).toEqual(SAMPLE_INCREASE_SEQUENCE);
    expect(instructions.decreaseSequence).toEqual(SAMPLE_DECREASE_SEQUENCE);
    expect(firstV.stitchesChangedOnAction).toEqual(SAMPLE_INCREASE_SEQUENCE);
    expect(secondV.stitchesChangedOnAction).toEqual(SAMPLE_DECREASE_SEQUENCE);
    expect(firstV.stitchesChangedOnAction.reduce((sum, n) => sum + n, 0)).toBe(
      calc.vNeckDepthStitches,
    );
  });

  it("returns held neckline stitches until all 110 needles are working", () => {
    expect(firstV.startStitches).toBe(70);
    expect(firstV.endStitches).toBe(110);
    expect(firstV.rows).toBe(26);
    expect(firstV.shapingActions).toBe(13);
    expect(firstV.workingStitchesAfterAction.at(-1)).toBe(110);
    expect(firstV.heldStitchesAfterAction.at(-1)).toBe(0);
    expect(firstV.encloseHeldStitchesOnFinalRow).toBe(false);
  });

  it("keeps the four shoulder sections at identical row counts", () => {
    expect(sectionRowCounts.firstFrontShoulder).toBe(sectionRowCounts.firstBackShoulder);
    expect(sectionRowCounts.firstBackShoulder).toBe(sectionRowCounts.secondBackShoulder);
    expect(sectionRowCounts.secondBackShoulder).toBe(sectionRowCounts.secondFrontShoulder);
    expect(sectionRowCounts.firstFrontShoulder).toBe(calc.shoulders.firstFrontRows);
    expect(sectionRowCounts.firstFrontShoulder).toBe(44);
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

  it("uses twice the even V-section rows for the straight back neck", () => {
    const opening = steps.find((s) => s.id === "back-neck-opening");
    expect(opening?.rows).toBe(calc.backNeckOpeningRows);
    expect(sectionRowCounts.backNeckOpening).toBe(52);
    expect(sectionRowCounts.backNeckOpening).toBe(2 * sectionRowCounts.firstVNeck);
    expect(opening?.stitchesAfter).toBe(instructions.backNeckLiveStitches);
  });

  it("places the matching V into hold, then encloses wraps on the last two-row interval", () => {
    expect(secondV.stitchesChangedOnAction).toEqual(SAMPLE_DECREASE_SEQUENCE);
    expect(secondV.startStitches).toBe(110);
    expect(secondV.endStitches).toBe(70);
    expect(secondV.workingStitchesAfterAction.at(-1)).toBe(70);
    expect(secondV.heldStitchesAfterAction.at(-1)).toBe(40);
    expect(secondV.encloseHeldStitchesOnFinalRow).toBe(true);
    const secondVStep = steps.find((s) => s.id === "second-v-neck");
    expect(secondVStep?.stitchesAfter).toBe(110);
    expect(secondVStep?.rowCounterEnd).toBe(280);
    expect(secondVStep?.summary).toMatch(/not RC 281/);
    expect(secondVStep?.summary).toContain(SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE);
    const finalBindOff = steps.find((s) => s.id === "bind-off-full-width");
    expect(finalBindOff?.stitchesBefore).toBe(110);
    expect(finalBindOff?.stitchesAfter).toBe(0);
    expect(finalBindOff?.summary).toMatch(/Bind off all 110 stitches loosely/);
  });

  it("starts the cardigan with scrap on, ravel cord, closed cast-on, and neckline in hold", () => {
    expect(steps.map((s) => s.id).slice(0, 4)).toEqual([
      "scrap-on-full-width",
      "ravel-cord",
      "closed-cast-on-full-width",
      "hold-neckline",
    ]);
    expect(steps.find((s) => s.id === "scrap-on-full-width")?.stitchesAfter).toBe(110);
    expect(steps.find((s) => s.id === "hold-neckline")?.stitchesAfter).toBe(70);
    expect(steps.find((s) => s.id === "first-v-neck")?.summary).toContain(
      SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE,
    );
    expect(
      steps.some((s) =>
        /\bCOL\b|\bCOR\b/.test(s.summary.replaceAll(SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE, "")),
      ),
    ).toBe(false);
  });

  it("locks the representative SAMPLE stitch counts, landmarks, and section rows", () => {
    expect(calc.garmentLengthStitches).toBe(110);
    expect(calc.vNeckDepthStitches).toBe(40);
    expect(instructions.startingFrontStitches).toBe(70);
    expect(calc.backNeckDepthStitches).toBe(6);
    expect(calc.armholeDepthStitches).toBe(36);
    expect(calc.neckOpeningRows).toBe(49);
    expect(calc.rawHalfNeckRows).toBe(25);
    expect(calc.halfNeckRows).toBe(26);
    expect(calc.frontRows).toBe(70);
    expect(calc.backRows).toBe(140);
    expect(calc.shoulders.firstFrontRows).toBe(44);
    expect(calc.bust.actualTotalBustRows).toBe(280);
    expect(sectionRowCounts).toEqual({
      firstVNeck: 26,
      firstFrontShoulder: 44,
      firstBackShoulder: 44,
      backNeckOpening: 52,
      secondBackShoulder: 44,
      secondFrontShoulder: 44,
      secondVNeck: 26,
    });
    expect(landmarks).toEqual({
      endFirstVShaping: 26,
      firstSideSeam: 70,
      firstBackNeckEdge: 114,
      secondBackNeckEdge: 166,
      secondSideSeam: 210,
      startFinalVShaping: 254,
      endSecondVShaping: 280,
      finalBindOff: 280,
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
    expect(landmarks.finalBindOff).not.toBe(281);
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

    const notSlope = buildSidewaysCardiganBodyInstructions({
      ...SAMPLE,
      vNeckDepthInches: 2,
    });
    expect(notSlope.ok).toBe(false);
    if (notSlope.ok) throw new Error("expected slope error");
    expect(notSlope.error.code).toBe(SIDEWAYS_CARDIGAN_V_NECK_NOT_SLOPE);
    if (notSlope.error.code === SIDEWAYS_CARDIGAN_V_NECK_NOT_SLOPE) {
      expect(notSlope.error.vNeckDepthStitches).toBe(10);
      expect(notSlope.error.halfNeckRows).toBe(26);
      expect(notSlope.error.shapingActions).toBe(13);
    }
    expect(notSlope.error.message).not.toMatch(/must exceed the even half-neck rows/i);
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

function slitIds(steps: { id: string }[]): string[] {
  return steps.filter((s) => /armhole-slit/.test(s.id)).map((s) => s.id);
}

describe("sideways pullover body instruction model", () => {
  const cardigan = instructionsOk();
  const pulloverResult = buildSidewaysCardiganBodyInstructions(SAMPLE, "pullover");
  expect(pulloverResult.ok).toBe(true);
  if (!pulloverResult.ok) throw new Error(pulloverResult.error.message);
  const pullover = pulloverResult.instructions;
  const fullWidth = pullover.calc.garmentLengthStitches;
  const vPoint = pullover.startingFrontStitches;

  it("defaults missing garment style to cardigan and keeps the cardigan sequence", () => {
    expect(cardigan.garmentStyle).toBe("cardigan");
    expect(cardigan.steps.map((s) => s.id)).toEqual([
      "scrap-on-full-width",
      "ravel-cord",
      "closed-cast-on-full-width",
      "hold-neckline",
      "first-v-neck",
      "first-front-shoulder",
      "first-armhole-slit",
      "first-back-shoulder",
      "bind-off-back-neck",
      "back-neck-opening",
      "cast-on-back-neck",
      "second-back-shoulder",
      "second-armhole-slit",
      "second-front-shoulder",
      "second-v-neck",
      "bind-off-full-width",
    ]);
    expect(slitIds(cardigan.steps)).toEqual(["first-armhole-slit", "second-armhole-slit"]);
  });

  it("starts and ends the pullover with full garment-length stitches at a side seam", () => {
    const castOn = pullover.steps.find((s) => s.id === "cast-on-side-seam");
    const bindOff = pullover.steps.find((s) => s.id === "bind-off-side-seam");
    expect(castOn?.stitchesAfter).toBe(fullWidth);
    expect(castOn?.summary).toMatch(/side seam/i);
    expect(bindOff?.stitchesBefore).toBe(fullWidth);
    expect(bindOff?.stitchesAfter).toBe(0);
    expect(bindOff?.summary).toMatch(/original side seam/i);
    expect(pullover.steps[0]?.id).toBe("cast-on-side-seam");
    expect(pullover.steps.at(-1)?.id).toBe("bind-off-side-seam");
  });

  it("shapes the pullover down to the V point and back to full length", () => {
    expect(pullover.firstV.startStitches).toBe(fullWidth);
    expect(pullover.firstV.endStitches).toBe(vPoint);
    expect(pullover.firstV.workingStitchesAfterAction.at(-1)).toBe(vPoint);
    expect(pullover.firstV.heldStitchesAfterAction.at(-1)).toBe(40);
    expect(pullover.secondV.startStitches).toBe(vPoint);
    expect(pullover.secondV.endStitches).toBe(fullWidth);
    expect(pullover.secondV.workingStitchesAfterAction.at(-1)).toBe(fullWidth);
    expect(pullover.secondV.heldStitchesAfterAction.at(-1)).toBe(0);
    expect(pullover.firstV.encloseHeldStitchesOnFinalRow).toBe(false);
    expect(pullover.secondV.encloseHeldStitchesOnFinalRow).toBe(false);
    expect(pullover.increaseSequence).toEqual(SAMPLE_INCREASE_SEQUENCE);
    expect(pullover.decreaseSequence).toEqual(SAMPLE_DECREASE_SEQUENCE);
    expect(pullover.firstV.stitchesChangedOnAction).toEqual(SAMPLE_DECREASE_SEQUENCE);
    expect(pullover.secondV.stitchesChangedOnAction).toEqual(SAMPLE_INCREASE_SEQUENCE);
    expect(pullover.steps.find((s) => s.id === "first-v-neck")?.summary).toContain(
      SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE,
    );
    expect(
      pullover.steps.some((s) =>
        /\bCOL\b|\bCOR\b/.test(s.summary.replaceAll(SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE, "")),
      ),
    ).toBe(false);
  });

  it("gives the pullover exactly one knitted armhole slit and the cardigan two", () => {
    expect(slitIds(pullover.steps)).toEqual(["knitted-armhole-slit"]);
    expect(slitIds(cardigan.steps)).toHaveLength(2);
    expect(knittedArmholeSlitCount(pullover.garmentStyle)).toBe(1);
    expect(knittedArmholeSlitCount(cardigan.garmentStyle)).toBe(2);
    expect(pullover.steps.find((s) => s.id === "knitted-armhole-slit")?.rows).toBe(0);
    expect(pullover.steps.some((s) => s.id === "second-armhole-slit")).toBe(false);
  });

  it("keeps four equal shoulders and matching V sections that sum to the back-neck on both styles", () => {
    for (const body of [cardigan, pullover]) {
      expect(body.sectionRowCounts.firstFrontShoulder).toBe(body.sectionRowCounts.firstBackShoulder);
      expect(body.sectionRowCounts.firstBackShoulder).toBe(body.sectionRowCounts.secondBackShoulder);
      expect(body.sectionRowCounts.secondBackShoulder).toBe(body.sectionRowCounts.secondFrontShoulder);
      expect(body.sectionRowCounts.firstVNeck).toBe(body.sectionRowCounts.secondVNeck);
      expect(body.sectionRowCounts.firstVNeck * 2).toBe(body.sectionRowCounts.backNeckOpening);
    }
  });

  it("locks pullover cumulative RC landmarks for the 40/7/7 example", () => {
    expect(pullover.sectionRowCounts).toEqual(cardigan.sectionRowCounts);
    expect(pullover.landmarks).toEqual({
      startFinalVShaping: 44,
      endFirstVShaping: 70,
      endSecondVShaping: 96,
      firstSideSeam: 0,
      secondSideSeam: 140,
      firstBackNeckEdge: 184,
      secondBackNeckEdge: 236,
      finalBindOff: 280,
    });
  });

  it("uses the same total bust rows and finished measurements for both styles", () => {
    expect(pullover.calc.bust.actualTotalBustRows).toBe(cardigan.calc.bust.actualTotalBustRows);
    expect(pullover.calc.bust.actualFinishedBustInches).toBe(
      cardigan.calc.bust.actualFinishedBustInches,
    );
    expect(pullover.calc.garmentLengthStitches).toBe(cardigan.calc.garmentLengthStitches);
    expect(pullover.calc.vNeckDepthStitches).toBe(cardigan.calc.vNeckDepthStitches);
    expect(pullover.calc.armholeDepthStitches).toBe(cardigan.calc.armholeDepthStitches);
    expect(pullover.calc.neckOpeningRows).toBe(cardigan.calc.neckOpeningRows);
    expect(pullover.landmarks.finalBindOff).toBe(pullover.calc.bust.actualTotalBustRows);
    const pulloverRows = pullover.steps.reduce((sum, s) => sum + s.rows, 0);
    const cardiganRows = cardigan.steps.reduce((sum, s) => sum + s.rows, 0);
    expect(pulloverRows).toBe(cardiganRows);
    expect(pulloverRows).toBe(pullover.calc.bust.actualTotalBustRows);
  });

  it("does not tell the knitter to graft or seam the center front", () => {
    const html = renderSidewaysCardiganBodySequenceHtml(pullover);
    expect(html).toMatch(/starts at a side seam/i);
    expect(html).toMatch(/one knitted armhole slit/i);
    expect(html).toMatch(/leaving the calculated armhole depth open/i);
    expect(html).not.toMatch(/graft/i);
    expect(html).not.toMatch(/seam the center front/i);
    const cardiganHtml = renderSidewaysCardiganBodySequenceHtml(cardigan);
    expect(cardiganHtml).toMatch(/starts at center front/i);
    expect(cardiganHtml).toMatch(/two knitted armhole slits/i);
  });

  it("keeps a chart-depth Pullover BODY when V-neck stitches are not greater than half-neck rows", () => {
    const chartDepth: SidewaysCardiganBodyCalcInput = {
      garmentLengthInches: 25,
      vNeckDepthInches: 5,
      finishedBustCircumferenceInches: 46,
      finishedUpperArmInches: 14.5,
      neckOpeningWidthInches: 7.5,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    };
    const calcResult = calculateSidewaysCardiganBody(chartDepth);
    expect(calcResult.ok).toBe(true);
    if (!calcResult.ok) throw new Error(calcResult.error.message);
    const { calc } = calcResult;
    expect(calc.vNeckDepthStitches).toBe(26);
    expect(calc.rawHalfNeckRows).toBe(26);
    expect(calc.halfNeckRows).toBe(26);
    expect(sidewaysVNeckShapingActions(calc.halfNeckRows)).toBe(13);
    expect(calculateSlopeShaping(calc.vNeckDepthStitches, calc.halfNeckRows).ok).toBe(false);

    const result = buildSidewaysCardiganBodyInstructions(chartDepth, "pullover");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.instructions.increaseSequence).toEqual(Array(13).fill(2));
    expect(result.instructions.decreaseSequence).toEqual(Array(13).fill(2));
    const html = renderSidewaysCardiganBodySequenceHtml(result.instructions);
    expect(html).toContain("sideways-body-sequence");
    expect(html).toMatch(/starts at a side seam/i);
  });

  it("builds Cardigan short-row V shaping from 26 stitches across 13 EOR actions, not 26 rows", () => {
    const sueCardigan: SidewaysCardiganBodyCalcInput = {
      garmentLengthInches: 25,
      vNeckDepthInches: 5,
      finishedBustCircumferenceInches: 46,
      finishedUpperArmInches: 14.5,
      neckOpeningWidthInches: 7.5,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    };
    const calcResult = calculateSidewaysCardiganBody(sueCardigan);
    expect(calcResult.ok).toBe(true);
    if (!calcResult.ok) throw new Error(calcResult.error.message);
    expect(calcResult.calc.vNeckDepthStitches).toBe(26);
    expect(calcResult.calc.rawHalfNeckRows).toBe(26);
    expect(calcResult.calc.halfNeckRows).toBe(26);
    expect(sidewaysVNeckShapingActions(26)).toBe(13);
    expect(calculateSlopeShaping(26, 26).ok).toBe(false);

    const result = buildSidewaysCardiganBodyInstructions(sueCardigan, "cardigan");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.instructions.garmentStyle).toBe("cardigan");
    expect(result.instructions.firstV.shapingActions).toBe(13);
    expect(result.instructions.increaseSequence).toEqual(Array(13).fill(2));
    expect(result.instructions.decreaseSequence).toEqual(Array(13).fill(2));
  });
});
