import { describe, expect, it } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { calculateDropShoulderSleevePieceNumbers } from "./dropShoulderSleevePieceNumbers";
import { sleeveEvenShapingSchedule } from "./evenShapingSchedule";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { calculateCuffRowsFromInches } from "./hemDefaults";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  calculateSidewaysCardiganSleeve,
  SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE,
  SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH,
  SIDEWAYS_CARDIGAN_SLEEVE_NEEDLES_EXCEEDED,
  SIDEWAYS_CARDIGAN_SLEEVE_NOT_ENOUGH_ROWS,
  SIDEWAYS_CARDIGAN_SLEEVE_TOP_ARMHOLE_MISMATCH,
  SIDEWAYS_CARDIGAN_SLEEVE_WRIST_NOT_NARROWER,
  SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE,
  type SidewaysCardiganSleeveCalcInput,
} from "./sidewaysCardiganSleeveCalc";
import {
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysCardiganSleeveSequenceHtml,
  sidewaysSleeveNotConnectedResult,
} from "./sidewaysCardiganSleeveInstructions";
import { buildSidewaysCardiganBodyInstructions } from "./sidewaysCardiganBodyInstructions";

const SAMPLE: SidewaysCardiganSleeveCalcInput = {
  direction: "cuff-up",
  finishedUpperArmInches: 14,
  finishedWristInches: 7,
  sleeveLengthInches: 17,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  cuffDepthInches: 2,
  armholeDepthInches: 7,
};

function sleeveOk(input: SidewaysCardiganSleeveCalcInput = SAMPLE) {
  const result = buildSidewaysCardiganSleeveInstructions(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.instructions;
}

function dropShoulderReusePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 7,
      easeChoice: "standard",
      selectedMeasurements: {
        finished_bust_chest: 42,
        back_neck_to_hem: 22,
        armhole_depth: 7,
        neck_opening: 7,
        shoulder_width: 13,
        front_neck_depth: 5,
        back_neck_depth: 1,
        upper_arm: 14,
        wrist: 7,
        sleeve_length: 17,
      },
      cbMeasurementOverrides: {
        upperArm: "14",
        wrist: "7",
        sleeveLength: "17",
      },
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      sleeveLength: "long",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

describe("sideways V-Neck sleeve reuses Drop Shoulder measurements", () => {
  it("uses the shared Drop Shoulder sleeve piece-number formula", () => {
    const generated = generateDropShoulderPattern(dropShoulderReusePattern());
    const fromDebug = calculateDropShoulderSleevePieceNumbers({
      finishedUpperArmInches: generated.debug.dropShoulderUpperArmInches,
      finishedWristInches: generated.debug.dropShoulderWristInches,
      sleeveLengthInches: generated.debug.dropShoulderSleeveLengthInches,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      cuffDepthInches: generated.debug.dropShoulderCuffDepthInches ?? 2,
    });
    expect(fromDebug.topSts).toBe(generated.debug.dropShoulderSleeveTopStitches);
    expect(fromDebug.wristSts).toBe(generated.debug.dropShoulderSleeveWristStitches);
    expect(fromDebug.cuffRows).toBe(generated.debug.dropShoulderSleeveCuffRows);
    expect(fromDebug.sleeveTotalRows).toBe(generated.debug.dropShoulderSleeveTotalRows);
    expect(fromDebug.sleeveBodyRows).toBe(generated.debug.dropShoulderSleeveBodyRows);

    const shared = calculateDropShoulderSleevePieceNumbers({
      finishedUpperArmInches: SAMPLE.finishedUpperArmInches,
      finishedWristInches: SAMPLE.finishedWristInches,
      sleeveLengthInches: SAMPLE.sleeveLengthInches,
      stitchesPerInch: SAMPLE.stitchesPerInch,
      rowsPerInch: SAMPLE.rowsPerInch,
      cuffDepthInches: SAMPLE.cuffDepthInches,
    });
    const sideways = sleeveOk();
    expect(sideways.calc.topSts).toBe(shared.topSts);
    expect(sideways.calc.wristSts).toBe(shared.wristSts);
    expect(sideways.calc.cuffRows).toBe(shared.cuffRows);
    expect(sideways.calc.sleeveTotalRows).toBe(shared.sleeveTotalRows);
    expect(sideways.calc.sleeveBodyRows).toBe(shared.sleeveBodyRows);
    expect(sideways.calc.shapingPlan.schedule).toEqual(
      sleeveEvenShapingSchedule(shared.topSts, shared.wristSts, shared.sleeveBodyRows),
    );
  });

  it("applies existing sweater even-stitch rounding and even cuff-row rounding", () => {
    const calc = sleeveOk().calc;
    expect(calc.topSts).toBe(
      evenPositiveBodyStitches(SAMPLE.finishedUpperArmInches * SAMPLE.stitchesPerInch),
    );
    expect(calc.wristSts).toBe(
      evenPositiveBodyStitches(SAMPLE.finishedWristInches * SAMPLE.stitchesPerInch),
    );
    expect(calc.cuffRows).toBe(
      calculateCuffRowsFromInches(SAMPLE.rowsPerInch, SAMPLE.cuffDepthInches),
    );
    expect(calc.sleeveTotalRows).toBe(
      Math.max(calc.cuffRows + 2, Math.round(SAMPLE.sleeveLengthInches * SAMPLE.rowsPerInch)),
    );
  });
});

describe("sideways V-Neck cuff-up and top-down numeric sequences", () => {
  const cuffUp = sleeveOk({ ...SAMPLE, direction: "cuff-up" });
  const topDown = sleeveOk({ ...SAMPLE, direction: "top-down" });

  it("begins cuff-up at the wrist and finishes at the upper arm", () => {
    expect(cuffUp.steps[0]?.id).toBe("cast-on-wrist");
    expect(cuffUp.steps[0]?.stitchesAfter).toBe(cuffUp.calc.wristSts);
    expect(cuffUp.steps.find((s) => s.id === "cuff")?.stitchesAfter).toBe(cuffUp.calc.wristSts);
    const body = cuffUp.steps.find((s) => s.id === "sleeve-body");
    expect(body?.stitchesBefore).toBe(cuffUp.calc.wristSts);
    expect(body?.stitchesAfter).toBe(cuffUp.calc.topSts);
    expect(cuffUp.steps.at(-1)?.id).toBe("bind-off-upper-arm");
    expect(cuffUp.steps.at(-1)?.stitchesBefore).toBe(cuffUp.calc.topSts);
    expect(cuffUp.calc.wristSts).toBeLessThan(cuffUp.calc.topSts);
  });

  it("begins top-down at the upper arm and finishes at the wrist", () => {
    expect(topDown.steps[0]?.id).toBe("cast-on-upper-arm");
    expect(topDown.steps[0]?.stitchesAfter).toBe(topDown.calc.topSts);
    const body = topDown.steps.find((s) => s.id === "sleeve-body");
    expect(body?.stitchesBefore).toBe(topDown.calc.topSts);
    expect(body?.stitchesAfter).toBe(topDown.calc.wristSts);
    expect(topDown.steps.find((s) => s.id === "cuff")?.stitchesAfter).toBe(topDown.calc.wristSts);
    expect(topDown.steps.at(-1)?.id).toBe("bind-off-wrist");
    expect(topDown.steps.at(-1)?.stitchesBefore).toBe(topDown.calc.wristSts);
  });

  it("produces identical finished measurements in both directions", () => {
    expect(cuffUp.calc.finished).toEqual(topDown.calc.finished);
    expect(cuffUp.calc.topSts).toBe(topDown.calc.topSts);
    expect(cuffUp.calc.wristSts).toBe(topDown.calc.wristSts);
    expect(cuffUp.calc.cuffRows).toBe(topDown.calc.cuffRows);
    expect(cuffUp.calc.sleeveBodyRows).toBe(topDown.calc.sleeveBodyRows);
    expect(cuffUp.calc.sleeveTotalRows).toBe(topDown.calc.sleeveTotalRows);
    expect(cuffUp.calc.shapingPlan.schedule).toEqual(topDown.calc.shapingPlan.schedule);
    expect(cuffUp.calc.shapingPlan.shapingDirection).toBe("increase");
    expect(topDown.calc.shapingPlan.shapingDirection).toBe("decrease");
  });

  it("accepts a short user-entered sleeve length without a separate style category", () => {
    const shortLen = sleeveOk({ ...SAMPLE, sleeveLengthInches: 8 });
    const longLen = sleeveOk({ ...SAMPLE, sleeveLengthInches: 17 });
    expect(shortLen.calc.sleeveTotalRows).toBeLessThan(longLen.calc.sleeveTotalRows);
    expect(shortLen.calc.finished.sleeveLengthInches).toBe(8);
    expect(longLen.calc.finished.sleeveLengthInches).toBe(17);
    expect(shortLen.calc.topSts).toBe(longLen.calc.topSts);
    expect(shortLen.calc.wristSts).toBe(longLen.calc.wristSts);
    expect(shortLen.steps[0]?.id).toBe("cast-on-wrist");
    expect(shortLen.steps.at(-1)?.id).toBe("bind-off-upper-arm");
  });

  it("matches the sleeve top to the complete armhole opening", () => {
    const body = calculateSidewaysCardiganBody({
      garmentLengthInches: 22,
      vNeckDepthInches: 8,
      finishedBustCircumferenceInches: 40,
      finishedUpperArmInches: SAMPLE.finishedUpperArmInches,
      neckOpeningWidthInches: 7,
      stitchesPerInch: SAMPLE.stitchesPerInch,
      rowsPerInch: SAMPLE.rowsPerInch,
    });
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error(body.error.message);
    expect(computeDropShoulderArmholeDepthInches(SAMPLE.finishedUpperArmInches)).toBe(
      SAMPLE.finishedUpperArmInches / 2,
    );
    expect(cuffUp.calc.finished.sleeveTopWidthInches).toBe(SAMPLE.finishedUpperArmInches);
    expect(cuffUp.calc.finished.armholeSlitDepthInches).toBe(body.calc.armholeDepthInches);
    expect(cuffUp.calc.finished.sleeveTopWidthInches).toBe(
      2 * cuffUp.calc.finished.armholeSlitDepthInches,
    );
    expect(cuffUp.calc.topSts).toBe(
      evenPositiveBodyStitches(SAMPLE.finishedUpperArmInches * SAMPLE.stitchesPerInch),
    );
  });
});

describe("sideways V-Neck sleeve validation", () => {
  it("returns a clear error when sleeve length is missing", () => {
    const result = calculateSidewaysCardiganSleeve({ ...SAMPLE, sleeveLengthInches: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected missing length");
    expect(result.error.code).toBe(SIDEWAYS_CARDIGAN_SLEEVE_MISSING_LENGTH);
    expect(result.error.message).toMatch(/sleeve length/i);
  });

  it("returns a clear error when gauge is missing", () => {
    const result = calculateSidewaysCardiganSleeve({ ...SAMPLE, stitchesPerInch: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected missing gauge");
    expect(result.error.code).toBe(SIDEWAYS_CARDIGAN_SLEEVE_MISSING_GAUGE);
    expect(result.error.message).toMatch(/gauge/i);
  });

  it("returns a clear error when wrist stitches are not less than upper-arm stitches and shaping is required", () => {
    const result = calculateSidewaysCardiganSleeve({
      ...SAMPLE,
      finishedWristInches: 15,
      finishedUpperArmInches: 14,
      armholeDepthInches: 7,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected wrist validation");
    expect(result.error.code).toBe(SIDEWAYS_CARDIGAN_SLEEVE_WRIST_NOT_NARROWER);
    expect(result.error.message).toMatch(/wrist stitches must be less/i);
  });

  it("allows a straight sleeve when wrist and upper-arm stitches match", () => {
    const result = sleeveOk({
      ...SAMPLE,
      finishedWristInches: 14,
      finishedUpperArmInches: 14,
      armholeDepthInches: 7,
    });
    expect(result.calc.shapingPlan.noShaping).toBe(true);
    expect(result.calc.wristSts).toBe(result.calc.topSts);
  });

  it("returns a clear error when there are not enough rows to distribute shaping", () => {
    const result = calculateSidewaysCardiganSleeve({
      ...SAMPLE,
      sleeveLengthInches: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not enough rows");
    expect(result.error.code).toBe(SIDEWAYS_CARDIGAN_SLEEVE_NOT_ENOUGH_ROWS);
    expect(result.error.message).toMatch(/not long enough to distribute/i);
  });

  it("returns a clear error when sleeve-top width is not twice the armhole slit depth", () => {
    const result = calculateSidewaysCardiganSleeve({
      ...SAMPLE,
      armholeDepthInches: 8,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected armhole mismatch");
    expect(result.error.code).toBe(SIDEWAYS_CARDIGAN_SLEEVE_TOP_ARMHOLE_MISMATCH);
    expect(result.error.message).toMatch(/twice the armhole slit/i);
  });

  it("returns a clear error when needle capacity is exceeded", () => {
    const result = calculateSidewaysCardiganSleeve({
      ...SAMPLE,
      availableNeedles: 40,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected needles exceeded");
    expect(result.error.code).toBe(SIDEWAYS_CARDIGAN_SLEEVE_NEEDLES_EXCEEDED);
    expect(result.error.message).toMatch(/needles/i);
    expect(result.error.message).toMatch(/upper-arm stitch count/i);
  });
});

describe("sideways sleeve is not substituted for the sideways direction", () => {
  it("does not build a cuff-up or top-down sequence for sideways", () => {
    const result = sidewaysSleeveNotConnectedResult();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not connected");
    expect(result.error.message).toBe(SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE);
    expect(result.error.message).not.toMatch(/cast on/i);
  });
});

describe("Drop Shoulder and Sleeveless behavior remains unchanged", () => {
  it("still writes Drop Shoulder sleeve display rows from the shared piece numbers", () => {
    const result = generateDropShoulderPattern(dropShoulderReusePattern());
    expect(result.isDropShoulder).toBe(true);
    expect(result.sleeveDisplayRows.some((row) => row.kind === "piece" && row.title === "SLEEVE")).toBe(
      true,
    );
    expect(result.sleeveDisplayRows.some((row) => row.kind === "section" && row.title === "CUFF")).toBe(
      true,
    );
    const shared = calculateDropShoulderSleevePieceNumbers({
      finishedUpperArmInches: 14,
      finishedWristInches: 7,
      sleeveLengthInches: 17,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      cuffDepthInches: 2,
    });
    expect(result.debug.dropShoulderSleeveTopStitches).toBe(shared.topSts);
    expect(result.debug.dropShoulderSleeveWristStitches).toBe(shared.wristSts);
  });

  it("does not add a sleeve piece to Sleeveless pattern output", () => {
    const result = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 39,
          back_neck_to_hem: 18,
          armhole_depth: 8,
          neck_opening: 6,
          shoulder_width: 12,
          front_neck_depth: 5,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses", neckline: "v-neck" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 4,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    });
    expect("isDropShoulder" in result).toBe(false);
    expect("sleeveDisplayRows" in result).toBe(false);
    expect(result.displayRows.some((row) => row.kind === "piece" && row.title === "SLEEVE")).toBe(
      false,
    );
  });

  it("leaves the Sideways body sequence unchanged", () => {
    const body = buildSidewaysCardiganBodyInstructions({
      garmentLengthInches: 22,
      vNeckDepthInches: 8,
      finishedBustCircumferenceInches: 40,
      finishedUpperArmInches: 14,
      neckOpeningWidthInches: 7,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error(body.error.message);
    expect(body.instructions.steps).toHaveLength(13);
    expect(body.instructions.steps.some((s) => s.id.includes("sleeve"))).toBe(false);
  });
});

describe("sideways sleeve HTML is a temporary numeric list", () => {
  it("renders cuff-up as an ordered numeric sequence", () => {
    const html = renderSidewaysCardiganSleeveSequenceHtml(sleeveOk());
    expect(html).toContain("sideways-sleeve-sequence");
    expect(html).toContain("Cast on");
    expect(html).toContain("Bind off");
    expect(html).not.toMatch(/Begin sleeve shaping/i);
  });
});
