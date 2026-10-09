/**
 * Set-in sleeve cap calculator (calculation only).
 *
 * One sleeveless armhole plan is used for the front and the back. The sleeve
 * underarm bind-off matches that plan. Finished upper-arm width comes from the
 * Drop Shoulder ease table. There is no extra sleeve-cap ease.
 *
 * Armhole rows = round(depth × row gauge). That total includes the two underarm
 * bind-off rows. Straight rows = armhole rows − 2 − decrease rows. This is the
 * knitted armhole, two rows shorter than `calculateArmholeShaping`'s `evenRows`.
 *
 * Top-of-cap width = finished upper arm ÷ 4 − ¼ inch.
 * Upper slope = 1 inch wide and about ½ inch tall.
 * Working-cap height = √(remaining seam² − remaining width²).
 * The curve is divided into lower, middle, and upper decrease zones.
 */

import { magicFormulaIntervals } from "../../shaping/autoShaping";
import { calculateArmholeShaping } from "../legoBlocks/armholeShaping";
import {
  dropShoulderSleeveEaseGroupForChartAudience,
  normalizeSleeveEaseFit,
  resolveDropShoulderFinishedUpperArmInches,
  resolveDropShoulderUpperArmEaseInches,
} from "../dropShoulderSleeveEase";
import {
  evenPositiveBodyStitches,
  sleevelessBackHalfStitchesFromCircumference,
} from "../sleevelessBodyStitchMath";

export const TOP_OF_CAP_WIDTH_DIVISOR = 4;
export const TOP_OF_CAP_WIDTH_REDUCTION_INCHES = 0.25;
export const UPPER_SLOPE_WIDTH_INCHES = 1;
export const UPPER_SLOPE_HEIGHT_INCHES = 0.5;
export const UNDERARM_BIND_OFF_ROWS = 2;
/** A sleeve-cap seam this close to the armhole edge is accepted. */
export const SLEEVE_CAP_SEAM_TOLERANCE_INCHES = 0.5;

export type SleeveCapZoneName = "lower" | "middle" | "upper";
export type SleeveCapPace = "faster" | "slower";
export type SleeveCapStitchDivision = "thirds" | "adjusted";

export type SleeveCapFailureReason =
  | "invalid-input"
  | "adult-sizes-only"
  | "upper-arm"
  | "armhole-shaping"
  | "armhole-too-shallow"
  | "top-width"
  | "upper-slope"
  | "working-width"
  | "impossible-geometry"
  | "zone-shaping"
  | "decrease-schedule"
  | "stitch-accounting"
  | "seam-mismatch";

export type SetInSleeveCapInput = {
  /** Finished bust or chest, inches. Already includes body ease, as the sleeveless builder uses it. */
  finishedBustInches: number;
  /** Shoulder width, inches. Same measurement the sleeveless builder uses for stitches after the armhole. */
  shoulderWidthInches: number;
  /** Armhole depth, inches. */
  armholeDepthInches: number;
  /** Body upper-arm circumference before sleeve ease, inches. */
  bodyUpperArmInches: number;
  /** Sizing audience. Adults only: misses, plus, men. */
  chartAudience: string;
  /** Upper-arm ease fit. Defaults to standard (2 inches for adults). */
  fit?: string;
  stitchesPerInch: number;
  rowsPerInch: number;
};

/** One paired decrease instruction: remove the same stitches at both edges. */
export type PairedDecreaseInstruction = {
  stitchesEachSide: number;
  /** Row span of one repeat, including the shaping row. */
  everyRows: number;
  times: number;
};

export type UpperSlopeStep = {
  stitchesEachSide: number;
  /** Bind off on one side, then the other. */
  rows: 2;
};

export type SleeveCapZone = {
  name: SleeveCapZoneName;
  pace: SleeveCapPace;
  stitchesEachSide: number;
  rows: number;
  steps: PairedDecreaseInstruction[];
};

export type SleeveCapPhase =
  | {
      kind: "underarm-bind-off";
      stitchesEachSide: number;
      rows: number;
      stitchesAfter: number;
    }
  | {
      kind: "decrease-zone";
      zone: SleeveCapZoneName;
      pace: SleeveCapPace;
      stitchesEachSide: number;
      rows: number;
      steps: PairedDecreaseInstruction[];
      stitchesAfter: number;
    }
  | {
      kind: "upper-slope";
      stitchesEachSide: number;
      rows: number;
      steps: UpperSlopeStep[];
      plainRows: number;
      stitchesAfter: number;
    }
  | {
      kind: "top-bind-off";
      stitches: number;
    };

export type SetInSleeveCapSuccess = {
  ok: true;
  /** Cap ease is not added. The seam is drafted to the armhole edge. */
  intentionalCapEaseInches: 0;
  armhole: {
    /** This plan is used for both the front and the back. */
    appliesTo: "front-and-back";
    totalRows: number;
    bindOffStitchesEachSide: number;
    bindOffRows: number;
    decreaseStitchesEachSide: number;
    decreaseRows: number;
    straightRows: number;
    bodyStitchesAtUnderarm: number;
    bodyStitchesAtShoulder: number;
    edgeInches: number;
    underarmBindOffInches: number;
    decreaseEdgeInches: number;
    straightEdgeInches: number;
  };
  sleeve: {
    bodyUpperArmInches: number;
    upperArmEaseInches: number;
    finishedUpperArmInches: number;
    upperArmStitches: number;
    initialBindOffStitchesEachSide: number;
    initialBindOffRows: number;
  };
  top: {
    /** Exact inch width from the approved formula, before stitch rounding. */
    widthInches: number;
    stitches: number;
    knittedWidthInches: number;
  };
  upperSlope: {
    targetWidthInches: number;
    targetHeightInches: number;
    stitchesEachSide: number;
    rows: number;
    widthInches: number;
    heightInches: number;
    /** Straight edge used to solve the working-cap height. */
    edgeInches: number;
    /** Edge of the stepped decreases plus any plain rows. */
    knittedEdgeInches: number;
    steps: UpperSlopeStep[];
    plainRows: number;
  };
  workingCap: {
    stitchesEachSide: number;
    widthInches: number;
    /** Seam length assigned to the curve before it is divided into zones. */
    seamInches: number;
    geometricHeightInches: number;
    rows: number;
    knittedHeightInches: number;
    stitchDivision: SleeveCapStitchDivision;
    zones: {
      lower: SleeveCapZone;
      middle: SleeveCapZone;
      upper: SleeveCapZone;
    };
  };
  totals: {
    capRows: number;
    capHeightInches: number;
    finalStitches: number;
    finalWidthInches: number;
  };
  seam: {
    armholeEdgeInches: number;
    sleeveCapEdgeInches: number;
    /** Sleeve-cap edge minus armhole edge. */
    differenceInches: number;
    toleranceInches: number;
    underarmBindOffInches: number;
    lowerCapInches: number;
    middleCapInches: number;
    upperCapInches: number;
    upperSlopeInches: number;
    halfTopBindOffInches: number;
  };
  phases: SleeveCapPhase[];
};

export type SetInSleeveCapFailure = {
  ok: false;
  reason: SleeveCapFailureReason;
  message: string;
};

export type SetInSleeveCapResult = SetInSleeveCapSuccess | SetInSleeveCapFailure;

/** Finished top-of-cap width: upper arm ÷ 4, minus ¼ inch. */
export function topOfCapWidthInches(finishedUpperArmInches: number): number {
  return (
    finishedUpperArmInches / TOP_OF_CAP_WIDTH_DIVISOR - TOP_OF_CAP_WIDTH_REDUCTION_INCHES
  );
}

/**
 * Even row count for the upper slope.
 * Starts from round(½ inch × row gauge). An odd count gains one row so each
 * stepped decrease can be worked on both sides.
 */
export function upperSlopeRows(rowsPerInch: number): number {
  const nearest = Math.round(rowsPerInch * UPPER_SLOPE_HEIGHT_INCHES);
  const even = nearest % 2 === 0 ? nearest : nearest + 1;
  return Math.max(2, even);
}

function fail(reason: SleeveCapFailureReason, message: string): SetInSleeveCapFailure {
  return { ok: false, reason, message };
}

function positiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function nearestEvenStitchCount(stitches: number): number {
  return Math.round(stitches / 2) * 2;
}

function inches(n: number): string {
  return `${n.toFixed(2)} in`;
}

function middleIsSlower(
  lowerStitches: number,
  lowerRows: number,
  middleStitches: number,
  middleRows: number,
  upperStitches: number,
  upperRows: number,
): boolean {
  return (
    lowerStitches * middleRows > middleStitches * lowerRows &&
    upperStitches * middleRows > middleStitches * upperRows
  );
}

type ZoneSplit = {
  lowerStitches: number;
  middleStitches: number;
  upperStitches: number;
  lowerRows: number;
  middleRows: number;
  upperRows: number;
  stitchDivision: SleeveCapStitchDivision;
};

/**
 * Row split is ¼ / ½ / ¼, with leftover rows in the middle.
 * Stitches start as equal thirds, leftover stitches in the middle.
 * If that split cannot be knitted as faster / slower / faster, the nearest
 * split that can is used. The row split is not changed.
 */
function splitWorkingCap(stitchesEachSide: number, rows: number): ZoneSplit | null {
  const quarterRows = Math.floor(rows / 4);
  if (quarterRows < 1 || stitchesEachSide < 3) return null;
  const lowerRows = quarterRows;
  const upperRows = quarterRows;
  const middleRows = quarterRows * 2 + (rows - quarterRows * 4);

  const fits = (lower: number, middle: number, upper: number) =>
    lower >= 1 &&
    middle >= 1 &&
    upper >= 1 &&
    lower <= lowerRows &&
    middle <= middleRows &&
    upper <= upperRows &&
    middleIsSlower(lower, lowerRows, middle, middleRows, upper, upperRows);

  const third = Math.floor(stitchesEachSide / 3);
  const middleThird = stitchesEachSide - third * 2;
  if (fits(third, middleThird, third)) {
    return {
      lowerStitches: third,
      middleStitches: middleThird,
      upperStitches: third,
      lowerRows,
      middleRows,
      upperRows,
      stitchDivision: "thirds",
    };
  }

  let best: { lower: number; middle: number; upper: number; score: number } | null = null;
  const target = stitchesEachSide / 3;
  for (let lower = 1; lower <= Math.min(lowerRows, stitchesEachSide - 2); lower += 1) {
    for (let upper = 1; upper <= Math.min(upperRows, stitchesEachSide - lower - 1); upper += 1) {
      const middle = stitchesEachSide - lower - upper;
      if (!fits(lower, middle, upper)) continue;
      const score =
        Math.abs(lower - target) +
        Math.abs(upper - target) +
        Math.abs(middle - target) +
        Math.abs(lower - upper);
      if (!best || score < best.score) best = { lower, middle, upper, score };
    }
  }
  if (!best) return null;
  return {
    lowerStitches: best.lower,
    middleStitches: best.middle,
    upperStitches: best.upper,
    lowerRows,
    middleRows,
    upperRows,
    stitchDivision: "adjusted",
  };
}

function pairedDecreaseSteps(
  rows: number,
  stitchesEachSide: number,
): PairedDecreaseInstruction[] | null {
  if (stitchesEachSide < 1 || rows < stitchesEachSide) return null;
  const formula = magicFormulaIntervals(rows, stitchesEachSide);
  const scheduled = formula.shortCount + formula.longCount;
  const rowSum =
    formula.shortCount * formula.shortInterval + formula.longCount * formula.longInterval;
  if (
    scheduled !== stitchesEachSide ||
    rowSum !== rows ||
    formula.shortInterval < 1 ||
    (formula.longCount > 0 && formula.longInterval < 1)
  ) {
    return null;
  }
  const steps = formula.steps
    .filter((step) => step.times > 0 && step.rows > 0)
    .map((step) => ({
      stitchesEachSide: step.sts,
      everyRows: step.rows,
      times: step.times,
    }));
  const stitchSum = steps.reduce((sum, step) => sum + step.stitchesEachSide * step.times, 0);
  const consumed = steps.reduce((sum, step) => sum + step.everyRows * step.times, 0);
  if (stitchSum !== stitchesEachSide || consumed !== rows) return null;
  if (steps.some((step) => step.stitchesEachSide !== 1)) return null;
  return steps;
}

/** Smaller decreases first, so the slope gets steeper toward the shoulder. */
function ascendingSlopeSteps(stitchesEachSide: number, pairCount: number): number[] {
  const count = Math.min(pairCount, stitchesEachSide);
  const base = Math.floor(stitchesEachSide / count);
  let extra = stitchesEachSide - base * count;
  const amounts = Array.from({ length: count }, () => base);
  for (let index = count - 1; index >= 0 && extra > 0; index -= 1) {
    amounts[index] += 1;
    extra -= 1;
  }
  return amounts;
}

function zoneEdgeInches(
  stitchesEachSide: number,
  rows: number,
  stitchesPerInch: number,
  rowsPerInch: number,
): number {
  return Math.hypot(stitchesEachSide / stitchesPerInch, rows / rowsPerInch);
}

export function calculateSetInSleeveCap(input: SetInSleeveCapInput): SetInSleeveCapResult {
  const {
    finishedBustInches,
    shoulderWidthInches,
    armholeDepthInches,
    bodyUpperArmInches,
    chartAudience,
    stitchesPerInch,
    rowsPerInch,
  } = input;

  if (
    !positiveFinite(finishedBustInches) ||
    !positiveFinite(shoulderWidthInches) ||
    !positiveFinite(armholeDepthInches) ||
    !positiveFinite(bodyUpperArmInches) ||
    !positiveFinite(stitchesPerInch) ||
    !positiveFinite(rowsPerInch) ||
    typeof chartAudience !== "string" ||
    chartAudience.trim() === ""
  ) {
    return fail(
      "invalid-input",
      "Sleeve-cap calculation needs a finished bust, shoulder width, armhole depth, body upper arm, stitch gauge, and row gauge, all greater than zero.",
    );
  }

  const sizeGroup = dropShoulderSleeveEaseGroupForChartAudience(chartAudience);
  if (sizeGroup !== "adult") {
    return fail(
      "adult-sizes-only",
      "This sleeve cap is for adult sizes, including plus sizes. Children's and baby sizes are not calculated.",
    );
  }

  const fit = normalizeSleeveEaseFit(input.fit);
  const upperArmEaseInches = resolveDropShoulderUpperArmEaseInches({ chartAudience, fit });
  const finishedUpperArmInches = resolveDropShoulderFinishedUpperArmInches({
    chartAudience,
    fit,
    bodyUpperArmIn: bodyUpperArmInches,
  });
  if (upperArmEaseInches === undefined || finishedUpperArmInches === undefined) {
    return fail(
      "upper-arm",
      "Finished upper-arm width could not be calculated from the body upper arm and Drop Shoulder ease.",
    );
  }

  const upperArmStitches = evenPositiveBodyStitches(finishedUpperArmInches * stitchesPerInch);
  if (upperArmStitches < 4) {
    return fail(
      "upper-arm",
      `Finished upper arm ${inches(finishedUpperArmInches)} is only ${upperArmStitches} stitches at this gauge. The sleeve needs enough stitches for an underarm bind-off and a cap.`,
    );
  }

  const bodyStitchesAtUnderarm = sleevelessBackHalfStitchesFromCircumference(
    finishedBustInches,
    stitchesPerInch,
  );
  const bodyStitchesAtShoulder = evenPositiveBodyStitches(shoulderWidthInches * stitchesPerInch);
  if (bodyStitchesAtUnderarm < 4 || bodyStitchesAtShoulder < 2) {
    return fail(
      "armhole-shaping",
      "Bust and shoulder width do not produce enough stitches for an armhole at this gauge.",
    );
  }

  const totalArmholeRows = Math.round(armholeDepthInches * rowsPerInch);
  if (totalArmholeRows < UNDERARM_BIND_OFF_ROWS) {
    return fail(
      "armhole-too-shallow",
      `Armhole depth ${inches(armholeDepthInches)} is ${totalArmholeRows} rows. The underarm bind-off needs ${UNDERARM_BIND_OFF_ROWS} rows before any other shaping.`,
    );
  }

  let armhole: ReturnType<typeof calculateArmholeShaping>;
  try {
    armhole = calculateArmholeShaping({
      startingStitches: bodyStitchesAtUnderarm,
      targetStitches: bodyStitchesAtShoulder,
      totalRows: totalArmholeRows,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail(
      "armhole-shaping",
      `The body armhole cannot be shaped from these measurements. ${detail}`,
    );
  }

  if (armhole.decreaseRows !== armhole.decreaseSts * 2) {
    return fail(
      "armhole-shaping",
      "Armhole decreases are not every other row, so the sleeve cap cannot match that armhole.",
    );
  }

  const straightRows = totalArmholeRows - UNDERARM_BIND_OFF_ROWS - armhole.decreaseRows;
  if (straightRows < 0) {
    return fail(
      "armhole-too-shallow",
      `This armhole is ${totalArmholeRows} rows deep, and the underarm bind-off plus decreases need ${UNDERARM_BIND_OFF_ROWS + armhole.decreaseRows} rows. There are not enough rows to finish the armhole.`,
    );
  }

  const bindOffStitchesEachSide = armhole.bindOffSts;
  const underarmBindOffInches = bindOffStitchesEachSide / stitchesPerInch;
  const decreaseEdgeInches =
    armhole.decreaseSts === 0
      ? 0
      : zoneEdgeInches(armhole.decreaseSts, armhole.decreaseRows, stitchesPerInch, rowsPerInch);
  const straightEdgeInches = straightRows / rowsPerInch;
  const armholeEdgeInches = underarmBindOffInches + decreaseEdgeInches + straightEdgeInches;

  const topWidthInches = topOfCapWidthInches(finishedUpperArmInches);
  if (!(topWidthInches > 0)) {
    return fail(
      "top-width",
      `Finished upper arm ${inches(finishedUpperArmInches)} makes the top of the cap ${inches(topWidthInches)}. The top width has to be greater than zero.`,
    );
  }
  const topStitches = nearestEvenStitchCount(topWidthInches * stitchesPerInch);
  if (topStitches < 2) {
    return fail(
      "top-width",
      `The top of the cap, ${inches(topWidthInches)}, is narrower than 2 stitches at ${stitchesPerInch} stitches per inch.`,
    );
  }

  const slopeStitchesEachSide = Math.round(UPPER_SLOPE_WIDTH_INCHES * stitchesPerInch);
  const slopeRows = upperSlopeRows(rowsPerInch);
  if (slopeStitchesEachSide < 1 || slopeRows < 2) {
    return fail(
      "upper-slope",
      "The 1-inch upper slope does not cover a whole stitch and a pair of rows at this gauge.",
    );
  }
  const slopePairCount = slopeRows / 2;
  const slopeAmounts = ascendingSlopeSteps(slopeStitchesEachSide, slopePairCount);
  const slopeSteps: UpperSlopeStep[] = slopeAmounts.map((stitchesEachSide) => ({
    stitchesEachSide,
    rows: 2,
  }));
  const slopePlainRows = slopeRows - slopeSteps.length * 2;
  if (
    slopePlainRows < 0 ||
    slopeSteps.reduce((sum, step) => sum + step.stitchesEachSide, 0) !== slopeStitchesEachSide
  ) {
    return fail(
      "upper-slope",
      "The upper slope could not be divided into whole-stitch decreases over about ½ inch.",
    );
  }

  const slopeWidthInches = slopeStitchesEachSide / stitchesPerInch;
  const slopeHeightInches = slopeRows / rowsPerInch;
  const slopeEdgeInches = Math.hypot(slopeWidthInches, slopeHeightInches);
  const slopeKnittedEdgeInches =
    slopeSteps.reduce(
      (sum, step) => sum + Math.hypot(step.stitchesEachSide / stitchesPerInch, step.rows / rowsPerInch),
      0,
    ) + slopePlainRows / rowsPerInch;
  const halfTopBindOffInches = topStitches / stitchesPerInch / 2;

  const workingStitchesEachSide =
    upperArmStitches / 2 - bindOffStitchesEachSide - slopeStitchesEachSide - topStitches / 2;
  if (!Number.isInteger(workingStitchesEachSide) || workingStitchesEachSide < 3) {
    return fail(
      "working-width",
      `The sleeve is ${upperArmStitches} stitches wide. After the underarm bind-off (${bindOffStitchesEachSide} each side), the 1-inch upper slope (${slopeStitchesEachSide} each side), and the top of the cap (${topStitches} stitches), ${workingStitchesEachSide} stitches remain on each side for the curve. The curve needs at least 3 stitches on each side.`,
    );
  }

  const workingWidthInches = workingStitchesEachSide / stitchesPerInch;
  const workingSeamInches =
    armholeEdgeInches - underarmBindOffInches - slopeEdgeInches - halfTopBindOffInches;
  const heightSquared = workingSeamInches * workingSeamInches - workingWidthInches * workingWidthInches;
  if (!(workingSeamInches > workingWidthInches) || !(heightSquared > 0)) {
    return fail(
      "impossible-geometry",
      `The armhole edge left for the curved cap is ${inches(Math.max(0, workingSeamInches))}, and that curve has to cover ${inches(workingWidthInches)} of width. The seam is not long enough to form a sleeve cap.`,
    );
  }

  const geometricHeightInches = Math.sqrt(heightSquared);
  const workingRows = Math.round(geometricHeightInches * rowsPerInch);
  if (workingRows < 4) {
    return fail(
      "impossible-geometry",
      `The curved cap is only ${inches(geometricHeightInches)} tall (${workingRows} rows). It needs at least 4 rows so the lower, middle, and upper sections can each be knitted.`,
    );
  }

  const split = splitWorkingCap(workingStitchesEachSide, workingRows);
  if (!split) {
    return fail(
      "zone-shaping",
      `The curved cap needs ${workingStitchesEachSide} decreases on each side over ${workingRows} rows. No faster / slower / faster division fits those decreases into those rows.`,
    );
  }

  const lowerSteps = pairedDecreaseSteps(split.lowerRows, split.lowerStitches);
  const middleSteps = pairedDecreaseSteps(split.middleRows, split.middleStitches);
  const upperSteps = pairedDecreaseSteps(split.upperRows, split.upperStitches);
  if (!lowerSteps || !middleSteps || !upperSteps) {
    return fail(
      "decrease-schedule",
      `The curved cap's ${workingStitchesEachSide} decreases on each side could not be scheduled across ${workingRows} rows in whole stitches.`,
    );
  }

  const zones = {
    lower: {
      name: "lower" as const,
      pace: "faster" as const,
      stitchesEachSide: split.lowerStitches,
      rows: split.lowerRows,
      steps: lowerSteps,
    },
    middle: {
      name: "middle" as const,
      pace: "slower" as const,
      stitchesEachSide: split.middleStitches,
      rows: split.middleRows,
      steps: middleSteps,
    },
    upper: {
      name: "upper" as const,
      pace: "faster" as const,
      stitchesEachSide: split.upperStitches,
      rows: split.upperRows,
      steps: upperSteps,
    },
  };

  if (zones.lower.rows + zones.middle.rows + zones.upper.rows !== workingRows) {
    return fail(
      "zone-shaping",
      "The lower, middle, and upper cap sections do not add up to the curved-cap row count.",
    );
  }
  if (
    zones.lower.stitchesEachSide + zones.middle.stitchesEachSide + zones.upper.stitchesEachSide !==
    workingStitchesEachSide
  ) {
    return fail(
      "zone-shaping",
      "The lower, middle, and upper cap sections do not remove the stitches required for the curve.",
    );
  }

  let stitchesOnNeedle = upperArmStitches;
  const phases: SleeveCapPhase[] = [];
  stitchesOnNeedle -= 2 * bindOffStitchesEachSide;
  phases.push({
    kind: "underarm-bind-off",
    stitchesEachSide: bindOffStitchesEachSide,
    rows: UNDERARM_BIND_OFF_ROWS,
    stitchesAfter: stitchesOnNeedle,
  });
  for (const zone of [zones.lower, zones.middle, zones.upper]) {
    stitchesOnNeedle -= 2 * zone.stitchesEachSide;
    phases.push({
      kind: "decrease-zone",
      zone: zone.name,
      pace: zone.pace,
      stitchesEachSide: zone.stitchesEachSide,
      rows: zone.rows,
      steps: zone.steps,
      stitchesAfter: stitchesOnNeedle,
    });
  }
  stitchesOnNeedle -= 2 * slopeStitchesEachSide;
  phases.push({
    kind: "upper-slope",
    stitchesEachSide: slopeStitchesEachSide,
    rows: slopeRows,
    steps: slopeSteps,
    plainRows: slopePlainRows,
    stitchesAfter: stitchesOnNeedle,
  });
  if (stitchesOnNeedle !== topStitches) {
    return fail(
      "stitch-accounting",
      `After the cap shaping, ${stitchesOnNeedle} stitches remain. The top of the cap is ${topStitches} stitches (${inches(topWidthInches)}). Those counts do not match, so no pattern was produced.`,
    );
  }
  phases.push({ kind: "top-bind-off", stitches: topStitches });

  const lowerCapInches = zoneEdgeInches(
    zones.lower.stitchesEachSide,
    zones.lower.rows,
    stitchesPerInch,
    rowsPerInch,
  );
  const middleCapInches = zoneEdgeInches(
    zones.middle.stitchesEachSide,
    zones.middle.rows,
    stitchesPerInch,
    rowsPerInch,
  );
  const upperCapInches = zoneEdgeInches(
    zones.upper.stitchesEachSide,
    zones.upper.rows,
    stitchesPerInch,
    rowsPerInch,
  );
  const sleeveCapEdgeInches =
    underarmBindOffInches +
    lowerCapInches +
    middleCapInches +
    upperCapInches +
    slopeKnittedEdgeInches +
    halfTopBindOffInches;
  const differenceInches = sleeveCapEdgeInches - armholeEdgeInches;
  if (Math.abs(differenceInches) > SLEEVE_CAP_SEAM_TOLERANCE_INCHES) {
    return fail(
      "seam-mismatch",
      `The sleeve-cap seam is ${inches(sleeveCapEdgeInches)} and the armhole edge is ${inches(armholeEdgeInches)} (${inches(Math.abs(differenceInches))} apart). The match limit is ${inches(SLEEVE_CAP_SEAM_TOLERANCE_INCHES)}, so no pattern was produced.`,
    );
  }

  const capRows = UNDERARM_BIND_OFF_ROWS + workingRows + slopeRows;
  const wholeNumberCounts = [
    totalArmholeRows,
    bindOffStitchesEachSide,
    armhole.decreaseSts,
    armhole.decreaseRows,
    straightRows,
    bodyStitchesAtUnderarm,
    bodyStitchesAtShoulder,
    upperArmStitches,
    topStitches,
    slopeStitchesEachSide,
    slopeRows,
    slopePlainRows,
    workingStitchesEachSide,
    workingRows,
    zones.lower.stitchesEachSide,
    zones.middle.stitchesEachSide,
    zones.upper.stitchesEachSide,
    zones.lower.rows,
    zones.middle.rows,
    zones.upper.rows,
    capRows,
    stitchesOnNeedle,
  ];
  if (wholeNumberCounts.some((count) => !Number.isInteger(count))) {
    return fail(
      "stitch-accounting",
      "The sleeve cap produced a fractional stitch or row count. No pattern was produced.",
    );
  }

  return {
    ok: true,
    intentionalCapEaseInches: 0,
    armhole: {
      appliesTo: "front-and-back",
      totalRows: totalArmholeRows,
      bindOffStitchesEachSide,
      bindOffRows: UNDERARM_BIND_OFF_ROWS,
      decreaseStitchesEachSide: armhole.decreaseSts,
      decreaseRows: armhole.decreaseRows,
      straightRows,
      bodyStitchesAtUnderarm,
      bodyStitchesAtShoulder,
      edgeInches: armholeEdgeInches,
      underarmBindOffInches,
      decreaseEdgeInches,
      straightEdgeInches,
    },
    sleeve: {
      bodyUpperArmInches,
      upperArmEaseInches,
      finishedUpperArmInches,
      upperArmStitches,
      initialBindOffStitchesEachSide: bindOffStitchesEachSide,
      initialBindOffRows: UNDERARM_BIND_OFF_ROWS,
    },
    top: {
      widthInches: topWidthInches,
      stitches: topStitches,
      knittedWidthInches: topStitches / stitchesPerInch,
    },
    upperSlope: {
      targetWidthInches: UPPER_SLOPE_WIDTH_INCHES,
      targetHeightInches: UPPER_SLOPE_HEIGHT_INCHES,
      stitchesEachSide: slopeStitchesEachSide,
      rows: slopeRows,
      widthInches: slopeWidthInches,
      heightInches: slopeHeightInches,
      edgeInches: slopeEdgeInches,
      knittedEdgeInches: slopeKnittedEdgeInches,
      steps: slopeSteps,
      plainRows: slopePlainRows,
    },
    workingCap: {
      stitchesEachSide: workingStitchesEachSide,
      widthInches: workingWidthInches,
      seamInches: workingSeamInches,
      geometricHeightInches,
      rows: workingRows,
      knittedHeightInches: workingRows / rowsPerInch,
      stitchDivision: split.stitchDivision,
      zones,
    },
    totals: {
      capRows,
      capHeightInches: capRows / rowsPerInch,
      finalStitches: topStitches,
      finalWidthInches: topStitches / stitchesPerInch,
    },
    seam: {
      armholeEdgeInches,
      sleeveCapEdgeInches,
      differenceInches,
      toleranceInches: SLEEVE_CAP_SEAM_TOLERANCE_INCHES,
      underarmBindOffInches,
      lowerCapInches,
      middleCapInches,
      upperCapInches,
      upperSlopeInches: slopeKnittedEdgeInches,
      halfTopBindOffInches,
    },
    phases,
  };
}
