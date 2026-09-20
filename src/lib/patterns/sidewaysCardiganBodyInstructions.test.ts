import { describe, expect, it } from "vitest";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { distributeTotalAcrossRows } from "./distributeTotalAcrossRows";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  knittedArmholeSlitCount,
  renderSidewaysCardiganBodySequenceHtml,
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
      distributeTotalAcrossRows(calc.vNeckDepthStitches, calc.halfNeckRows),
    );
  });

  it("finishes the first V at full garment-length stitches", () => {
    expect(firstV.startStitches).toBe(instructions.startingFrontStitches);
    expect(firstV.endStitches).toBe(calc.garmentLengthStitches);
    expect(firstV.stitchesAfterRow.at(-1)).toBe(calc.garmentLengthStitches);
    expect(firstV.rows).toBe(calc.halfNeckRows);
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

  it("uses twice the V-section rows for the straight back neck", () => {
    const opening = steps.find((s) => s.id === "back-neck-opening");
    expect(opening?.rows).toBe(calc.backNeckOpeningRows);
    expect(sectionRowCounts.backNeckOpening).toBe(calc.backNeckOpeningRows);
    expect(sectionRowCounts.backNeckOpening).toBe(2 * sectionRowCounts.firstVNeck);
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
    expect(calc.halfNeckRows).toBe(25);
    expect(calc.frontRows).toBe(70);
    expect(calc.backRows).toBe(140);
    expect(calc.shoulders.firstFrontRows).toBe(45);
    expect(calc.bust.actualTotalBustRows).toBe(280);
    expect(sectionRowCounts).toEqual({
      firstVNeck: 25,
      firstFrontShoulder: 45,
      firstBackShoulder: 45,
      backNeckOpening: 50,
      secondBackShoulder: 45,
      secondFrontShoulder: 45,
      secondVNeck: 25,
    });
    expect(landmarks).toEqual({
      endFirstVShaping: 25,
      firstSideSeam: 70,
      firstBackNeckEdge: 115,
      secondBackNeckEdge: 165,
      secondSideSeam: 210,
      startFinalVShaping: 255,
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
      "cast-on-starting-front",
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
      "bind-off-starting-front",
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
    expect(pullover.firstV.stitchesAfterRow.at(-1)).toBe(vPoint);
    expect(pullover.secondV.startStitches).toBe(vPoint);
    expect(pullover.secondV.endStitches).toBe(fullWidth);
    expect(pullover.secondV.stitchesAfterRow.at(-1)).toBe(fullWidth);
    const added = pullover.secondV.stitchesChangedOnRow.reduce((sum, n) => sum + n, 0);
    const removed = pullover.firstV.stitchesChangedOnRow.reduce((sum, n) => sum + n, 0);
    expect(removed).toBe(pullover.calc.vNeckDepthStitches);
    expect(added).toBe(pullover.calc.vNeckDepthStitches);
    expect(pullover.secondV.stitchesChangedOnRow).toEqual(
      [...pullover.firstV.stitchesChangedOnRow].reverse(),
    );
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
      startFinalVShaping: 45,
      endFirstVShaping: 70,
      firstSideSeam: 0,
      secondSideSeam: 140,
      firstBackNeckEdge: 185,
      secondBackNeckEdge: 235,
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
});
