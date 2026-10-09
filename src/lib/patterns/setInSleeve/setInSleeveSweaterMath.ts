/**
 * Adult set-in sleeve sweater calculation coordinator.
 *
 * Combines the sleeveless body calculators, the drop-shoulder sleeve calculators
 * (cuff through upper arm), and the approved sleeve-cap module. This file does
 * not emit instructions, charts, or diagrams.
 *
 * Sleeve length is the cuff-to-upper-arm length from the drop-shoulder length
 * options. Sleeve-cap height is a separate measurement and is not folded into
 * that length.
 */

import { buildSleevelessBodyBlockPlan } from "../bodyBlock/sleevelessBodyBlock";
import { resolveEffectiveBackNeckDepthInches } from "../customBuildEffectiveNeckDepth";
import {
  dropShoulderSleeveEaseGroupForChartAudience,
  resolveDropShoulderFinishedUpperArmInches,
} from "../dropShoulderSleeveEase";
import { calculateDropShoulderSleevePieceNumbers } from "../dropShoulderSleevePieceNumbers";
import { resolveDropShoulderSleeveInches } from "../dropShoulderSleeveMeasurementOverrides";
import {
  dropShoulderSleeveShapingPlanForDirection,
  type DropShoulderSleeveShapingPlan,
} from "../dropShoulderSleeveShaping";
import type { DropShoulderSleeveDirection } from "../dropShoulderSleeveConstruction";
import { fitEaseInchesForChoice } from "../fitEaseInches";
import {
  calculateHemRowsFromInches,
  getDefaultCuffLengthInches,
  getDefaultHemLengthInches,
} from "../hemDefaults";
import {
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
  normalizeRoundNecklineDepthRows,
  type RoundNecklinePlanResult,
} from "../legoBlocks/roundNeckline";
import {
  DROP_SHOULDER_SLEEVE_LENGTH_CHOICES,
  type DropShoulderSleeveLengthChoice,
} from "../patternConstructionIdentity";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import {
  computeShoulderBindoffSchedule,
  type ShoulderBindoffSchedule,
} from "../shapingTimeline";
import {
  calculateSetInSleeveCap,
  UNDERARM_BIND_OFF_ROWS,
  type SetInSleeveCapFailure,
  type SetInSleeveCapSuccess,
} from "./sleeveCapMath";

const NO_SLEEVE_EDITS = {
  upperArm: false,
  sleeveLength: false,
  cuffCircumference: false,
} as const;

export type SetInSleeveSweaterFailureReason =
  | SetInSleeveCapFailure["reason"]
  | "body-length"
  | "body-shaping"
  | "neckline"
  | "sleeve-width";

export type SetInSleeveSweaterFailure = {
  ok: false;
  reason: SetInSleeveSweaterFailureReason;
  message: string;
};

export type SetInSleeveSweaterInput = {
  chartAudience: string;
  /** Fit choice used by the sleeveless body and the drop-shoulder sleeve ease tables. */
  fit?: string;
  chartRow: ChartRow;
  stitchesPerInch: number;
  rowsPerInch: number;
  /**
   * Working needles on the machine. When omitted, required counts are still
   * returned and fit is left unknown.
   */
  availableNeedles?: number;
  sleeveLengthChoice?: DropShoulderSleeveLengthChoice;
  /** Changes the sleeve shaping verb only. Piece measurements stay the same. */
  sleeveDirection?: DropShoulderSleeveDirection;
  /** Straight is the sweater default. A-line uses the sleeveless hip-to-bust body block. */
  bodyShape?: "straight" | "aline";
};

export type SetInSleeveNeedleCheck = {
  /** Widest body piece: hem cast-on or stitches at the underarm, whichever is larger. */
  bodyRequired: number;
  /** Sleeve cast-on width at the upper arm, before the cap decreases. */
  sleeveRequired: number;
  /** Needles required to knit every piece. */
  required: number;
  available: number | null;
  bodyFits: boolean | null;
  sleeveFits: boolean | null;
  fits: boolean | null;
  messages: string[];
};

export type SetInSleeveSweaterSuccess = {
  ok: true;
  chartAudience: string;
  fit: string;
  sleeveLengthChoice: DropShoulderSleeveLengthChoice;
  sleeveDirection: DropShoulderSleeveDirection;
  finished: {
    bustInches: number;
    hipInches: number;
    lengthInches: number;
    armholeDepthInches: number;
    shoulderWidthInches: number;
    neckWidthInches: number;
    frontNeckDepthInches: number;
    backNeckDepthInches: number;
    bodyEaseInches: number;
    bodyUpperArmInches: number;
    upperArmEaseInches: number;
    finishedUpperArmInches: number;
    wristInches: number;
    /** Cuff to upper arm. The sleeve cap is not included. */
    sleeveLengthInches: number;
  };
  body: {
    hemInches: number;
    hemRows: number;
    totalRows: number;
    /** Rows from the end of the hem to the first armhole row. */
    rowsToArmhole: number;
    stitchesAtUnderarm: number;
    stitchesAtShoulder: number;
    /** Front and back share this plan. Row counts use the corrected armhole budget. */
    armhole: SetInSleeveCapSuccess["armhole"];
    bodyBlock: ReturnType<typeof buildSleevelessBodyBlockPlan>;
    neckline: {
      openingStitches: number;
      shoulderStitchesPerSide: number;
      back: RoundNecklinePlanResult;
      front: RoundNecklinePlanResult;
      shoulderBindOff: ShoulderBindoffSchedule;
    };
  };
  sleeve: {
    cuffInches: number;
    cuffRows: number;
    /** Taper rows between the cuff and the upper arm. */
    rowsCuffToUpperArm: number;
    /** Cuff rows plus taper rows. Does not include sleeve-cap rows. */
    rowsToUpperArm: number;
    upperArmStitches: number;
    wristStitches: number;
    shaping: DropShoulderSleeveShapingPlan;
  };
  sleeveCap: SetInSleeveCapSuccess;
  rows: {
    bodyTotal: number;
    armhole: number;
    sleeveCuffToUpperArm: number;
    sleeveCap: number;
    /** Cuff, taper, and cap added together. Sleeve length in inches is still cuff-to-upper-arm only. */
    sleeveCuffThroughCap: number;
  };
  needles: SetInSleeveNeedleCheck;
  warnings: string[];
};

export type SetInSleeveSweaterResult = SetInSleeveSweaterSuccess | SetInSleeveSweaterFailure;

function fail(
  reason: SetInSleeveSweaterFailureReason,
  message: string,
): SetInSleeveSweaterFailure {
  return { ok: false, reason, message };
}

function positiveNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/**
 * Neck opening used by the sleeveless generator: round to a stitch, then drop
 * one stitch when the count is odd so the opening splits evenly.
 */
function neckOpeningStitches(neckWidthInches: number, stitchesPerInch: number): number {
  let stitches = Math.round(neckWidthInches * stitchesPerInch);
  if (stitches % 2 !== 0) stitches -= 1;
  return Math.max(0, stitches);
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value);
}

function needleFits(required: number, available: number | null): boolean | null {
  if (available === null) return null;
  return required <= available;
}

/**
 * Calculates an adult set-in sleeve sweater from a sizing-chart row and gauge.
 * Front and back armholes are the same plan.
 */
export function calculateSetInSleeveSweater(
  input: SetInSleeveSweaterInput,
): SetInSleeveSweaterResult {
  const chartAudience = input.chartAudience.trim();
  const fit = (input.fit ?? "standard").trim() || "standard";
  const sleeveLengthChoice = input.sleeveLengthChoice ?? "long";
  const sleeveDirection = input.sleeveDirection ?? "cuff-up";
  const bodyShape = input.bodyShape ?? "straight";
  const stitchesPerInch = input.stitchesPerInch;
  const rowsPerInch = input.rowsPerInch;

  if (dropShoulderSleeveEaseGroupForChartAudience(chartAudience) !== "adult") {
    return fail(
      "adult-sizes-only",
      "Set-in sleeve sweaters are calculated for adult sizes, including plus sizes.",
    );
  }
  if (!Number.isFinite(stitchesPerInch) || stitchesPerInch <= 0) {
    return fail("invalid-input", "Stitches per inch must be a positive number.");
  }
  if (!Number.isFinite(rowsPerInch) || rowsPerInch <= 0) {
    return fail("invalid-input", "Rows per inch must be a positive number.");
  }
  if (
    input.availableNeedles !== undefined &&
    (!Number.isInteger(input.availableNeedles) || input.availableNeedles <= 0)
  ) {
    return fail("invalid-input", "Available needles must be a positive whole number.");
  }
  if (!DROP_SHOULDER_SLEEVE_LENGTH_CHOICES.includes(sleeveLengthChoice)) {
    return fail("invalid-input", "Sleeve length choice is not one of the drop-shoulder options.");
  }

  const measurements = computeDefaultMeasurementsFromChartRow(input.chartRow, fit, {
    bodyShape,
  });
  const finishedBust = positiveNumber(measurements.finished_bust_chest);
  const finishedHip = positiveNumber(measurements.finished_hip);
  const garmentLength = positiveNumber(measurements.back_neck_to_hem);
  const armholeDepth = positiveNumber(measurements.armhole_depth);
  const shoulderWidth = positiveNumber(measurements.shoulder_width);
  const neckWidth = positiveNumber(measurements.neck_width);
  const frontNeckDepth = positiveNumber(measurements.front_neck_depth);
  const bodyUpperArm = positiveNumber(measurements.upper_arm);
  const chartBackNeck = positiveNumber(measurements.back_neck_depth);

  if (
    finishedBust === undefined ||
    finishedHip === undefined ||
    garmentLength === undefined ||
    armholeDepth === undefined ||
    shoulderWidth === undefined ||
    neckWidth === undefined ||
    frontNeckDepth === undefined ||
    bodyUpperArm === undefined ||
    chartBackNeck === undefined
  ) {
    return fail(
      "invalid-input",
      "The size chart row is missing a body or sleeve measurement needed for this sweater.",
    );
  }

  const backNeckDepth = resolveEffectiveBackNeckDepthInches({
    fit: { selectedMeasurements: { back_neck_depth: chartBackNeck } },
  });
  if (backNeckDepth === undefined) {
    return fail("neckline", "Back neck depth could not be resolved.");
  }

  const cap = calculateSetInSleeveCap({
    finishedBustInches: finishedBust,
    shoulderWidthInches: shoulderWidth,
    armholeDepthInches: armholeDepth,
    bodyUpperArmInches: bodyUpperArm,
    chartAudience,
    fit,
    stitchesPerInch,
    rowsPerInch,
  });
  if (!cap.ok) return cap;

  const correctedStraightRows =
    cap.armhole.totalRows - UNDERARM_BIND_OFF_ROWS - cap.armhole.decreaseRows;
  if (
    cap.armhole.straightRows !== correctedStraightRows ||
    cap.armhole.totalRows !== Math.round(armholeDepth * rowsPerInch)
  ) {
    return fail(
      "armhole-shaping",
      "The armhole row budget does not match the knitted armhole depth.",
    );
  }

  const sleeveInches = resolveDropShoulderSleeveInches({
    chartRow: input.chartRow,
    fitPreference: fit,
    chartAudience,
    bodyShape,
    sleeveLengthChoice,
    overrides: {},
    userEdited: NO_SLEEVE_EDITS,
  });
  if (
    sleeveInches.upperArmIn === undefined ||
    sleeveInches.wristIn === undefined ||
    sleeveInches.sleeveLengthIn === undefined
  ) {
    return fail("sleeve-width", "Sleeve length, upper arm, or cuff could not be resolved.");
  }
  if (sleeveInches.upperArmIn !== cap.sleeve.finishedUpperArmInches) {
    return fail(
      "sleeve-width",
      "The drop-shoulder finished upper arm does not match the sleeve-cap starting width.",
    );
  }

  const finishedUpperArm = resolveDropShoulderFinishedUpperArmInches({
    chartAudience,
    fit,
    bodyUpperArmIn: bodyUpperArm,
  });
  if (finishedUpperArm !== cap.sleeve.finishedUpperArmInches) {
    return fail(
      "sleeve-width",
      "Upper-arm ease did not match the sleeve-cap finished width.",
    );
  }

  const cuffInches = getDefaultCuffLengthInches(chartAudience);
  const sleevePiece = calculateDropShoulderSleevePieceNumbers({
    finishedUpperArmInches: cap.sleeve.finishedUpperArmInches,
    finishedWristInches: sleeveInches.wristIn,
    sleeveLengthInches: sleeveInches.sleeveLengthIn,
    stitchesPerInch,
    rowsPerInch,
    cuffDepthInches: cuffInches,
  });
  if (sleevePiece.topSts !== cap.sleeve.upperArmStitches) {
    return fail(
      "sleeve-width",
      "Sleeve stitches at the upper arm do not match the sleeve-cap starting stitches.",
    );
  }

  const hemInches = getDefaultHemLengthInches(chartAudience);
  const hemRows = calculateHemRowsFromInches(rowsPerInch, hemInches);
  const bodyTotalRows = Math.round(garmentLength * rowsPerInch);
  const rowsToArmhole = bodyTotalRows - hemRows - cap.armhole.totalRows;
  if (rowsToArmhole <= 0) {
    return fail(
      "body-length",
      "Garment length does not leave any rows between the hem and the armhole.",
    );
  }

  const bodyBlock = buildSleevelessBodyBlockPlan({
    garmentStyle: "pullover",
    pieceRole: "back",
    bustCircumferenceInches: finishedBust,
    hipCircumferenceInches: finishedHip,
    stitchesPerInch,
    rowsPerInch,
    rowsToArmhole,
    hemRows,
    precomputedBustStitches: cap.armhole.bodyStitchesAtUnderarm,
    mode: "auto",
  });
  if (!bodyBlock.validation.valid) {
    return fail(
      "body-shaping",
      bodyBlock.validation.errors.map((issue) => issue.message).join(" ") ||
        "Body shaping could not be calculated.",
    );
  }
  if (bodyBlock.armholeStartStitches !== cap.armhole.bodyStitchesAtUnderarm) {
    return fail(
      "body-shaping",
      "Body stitches at the armhole do not match the sleeve-cap armhole.",
    );
  }

  const openingStitches = neckOpeningStitches(neckWidth, stitchesPerInch);
  const shoulderStitchesPerSide = Math.floor(
    (cap.armhole.bodyStitchesAtShoulder - openingStitches) / 2,
  );
  if (openingStitches <= 0 || shoulderStitchesPerSide <= 0) {
    return fail(
      "neckline",
      "Neck opening and shoulder width do not leave stitches for both shoulders.",
    );
  }
  if (openingStitches >= cap.armhole.bodyStitchesAtShoulder) {
    return fail("neckline", "Neck opening is at least as wide as the shoulder line.");
  }

  const backNeckRows = normalizeRoundNecklineDepthRows(
    Math.max(1, Math.round(backNeckDepth * rowsPerInch)),
  );
  const frontNeckRows = normalizeRoundNecklineDepthRows(
    Math.max(1, Math.round(frontNeckDepth * rowsPerInch)),
  );
  const shoulderBindoffRows = Math.max(1, Math.round(rowsPerInch));

  const backNeck = calculateBackRoundNecklinePlan({
    necklineStitches: openingStitches,
    necklineDepthRows: backNeckRows,
  });
  const frontNeck = calculateRoundNecklinePlan({
    necklineStitches: openingStitches,
    necklineDepthRows: frontNeckRows,
  });
  if (backNeck.totalCheck !== openingStitches || frontNeck.totalCheck !== openingStitches) {
    return fail("neckline", "Neckline stitch totals do not match the neck opening.");
  }

  const shoulderBindOff = computeShoulderBindoffSchedule({
    firstShapingRow: 0,
    shoulderStitchesPerSide,
    centerNeckBindOff: openingStitches,
    neckDepthRows: backNeckRows,
    neckProfile: "back",
    stitchesAfterArmhole: cap.armhole.bodyStitchesAtShoulder,
    shoulderBindoffRows,
  });
  if (!shoulderBindOff) {
    return fail("neckline", "Shoulder bind-off could not be scheduled.");
  }

  const shaping = dropShoulderSleeveShapingPlanForDirection(
    {
      topSts: sleevePiece.topSts,
      wristSts: sleevePiece.wristSts,
      sleeveBodyRows: sleevePiece.sleeveBodyRows,
    },
    sleeveDirection,
  );

  const stitchCounts = [
    cap.armhole.totalRows,
    cap.armhole.bindOffStitchesEachSide,
    cap.armhole.decreaseStitchesEachSide,
    cap.armhole.decreaseRows,
    cap.armhole.straightRows,
    cap.armhole.bodyStitchesAtUnderarm,
    cap.armhole.bodyStitchesAtShoulder,
    cap.sleeve.upperArmStitches,
    cap.top.stitches,
    cap.totals.capRows,
    cap.totals.finalStitches,
    sleevePiece.topSts,
    sleevePiece.wristSts,
    sleevePiece.cuffRows,
    sleevePiece.sleeveBodyRows,
    sleevePiece.sleeveTotalRows,
    hemRows,
    bodyTotalRows,
    rowsToArmhole,
    openingStitches,
    shoulderStitchesPerSide,
    bodyBlock.hemStitches,
    bodyBlock.bustStitches,
  ];
  if (stitchCounts.some((count) => !isWholeNumber(count) || count < 0)) {
    return fail("stitch-accounting", "A stitch or row count was not a whole number.");
  }

  const available = input.availableNeedles ?? null;
  const bodyRequired = Math.max(bodyBlock.hemStitches, cap.armhole.bodyStitchesAtUnderarm);
  const sleeveRequired = sleevePiece.topSts;
  const required = Math.max(bodyRequired, sleeveRequired);
  const bodyFits = needleFits(bodyRequired, available);
  const sleeveFits = needleFits(sleeveRequired, available);
  const messages: string[] = [];
  if (bodyFits === false) {
    messages.push(
      `The body needs ${bodyRequired} needles and the machine has ${available}.`,
    );
  }
  if (sleeveFits === false) {
    messages.push(
      `The sleeve needs ${sleeveRequired} needles and the machine has ${available}.`,
    );
  }

  const warnings = [
    ...bodyBlock.warnings,
    ...backNeck.warnings,
    ...frontNeck.warnings,
  ];

  return {
    ok: true,
    chartAudience,
    fit,
    sleeveLengthChoice,
    sleeveDirection,
    finished: {
      bustInches: finishedBust,
      hipInches: finishedHip,
      lengthInches: garmentLength,
      armholeDepthInches: armholeDepth,
      shoulderWidthInches: shoulderWidth,
      neckWidthInches: neckWidth,
      frontNeckDepthInches: frontNeckDepth,
      backNeckDepthInches: backNeckDepth,
      bodyEaseInches: fitEaseInchesForChoice(fit),
      bodyUpperArmInches: bodyUpperArm,
      upperArmEaseInches: cap.sleeve.upperArmEaseInches,
      finishedUpperArmInches: cap.sleeve.finishedUpperArmInches,
      wristInches: sleeveInches.wristIn,
      sleeveLengthInches: sleeveInches.sleeveLengthIn,
    },
    body: {
      hemInches,
      hemRows,
      totalRows: bodyTotalRows,
      rowsToArmhole,
      stitchesAtUnderarm: cap.armhole.bodyStitchesAtUnderarm,
      stitchesAtShoulder: cap.armhole.bodyStitchesAtShoulder,
      armhole: cap.armhole,
      bodyBlock,
      neckline: {
        openingStitches,
        shoulderStitchesPerSide,
        back: backNeck,
        front: frontNeck,
        shoulderBindOff,
      },
    },
    sleeve: {
      cuffInches,
      cuffRows: sleevePiece.cuffRows,
      rowsCuffToUpperArm: sleevePiece.sleeveBodyRows,
      rowsToUpperArm: sleevePiece.sleeveTotalRows,
      upperArmStitches: sleevePiece.topSts,
      wristStitches: sleevePiece.wristSts,
      shaping,
    },
    sleeveCap: cap,
    rows: {
      bodyTotal: bodyTotalRows,
      armhole: cap.armhole.totalRows,
      sleeveCuffToUpperArm: sleevePiece.sleeveTotalRows,
      sleeveCap: cap.totals.capRows,
      sleeveCuffThroughCap: sleevePiece.sleeveTotalRows + cap.totals.capRows,
    },
    needles: {
      bodyRequired,
      sleeveRequired,
      required,
      available,
      bodyFits,
      sleeveFits,
      fits: bodyFits === null || sleeveFits === null ? null : bodyFits && sleeveFits,
      messages,
    },
    warnings,
  };
}
