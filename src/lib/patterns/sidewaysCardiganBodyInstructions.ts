/**
 * Numeric Sideways Cardigan body instruction model.
 *
 * V-neck short-row shaping returns (or holds) V-neck-depth stitches every other row
 * across the even half-neck row count. Action count is ceil(halfNeckRows / 2). Stitches
 * are compared to that action count, not to the row count — depth is a stitch-gauge
 * measurement and half-neck width is a row-gauge measurement.
 *
 * Armhole bind-off/cast-on and back-neck bind-off/cast-on do not add measured row sections.
 */

import { distributeTotalAcrossRows } from "./distributeTotalAcrossRows";
import {
  calculateSidewaysCardiganBody,
  type SidewaysCardiganBodyCalc,
  type SidewaysCardiganBodyCalcError,
  type SidewaysCardiganBodyCalcInput,
} from "./sidewaysCardiganBodyCalc";
import {
  parseSidewaysCardiganGarmentStyle,
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT,
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  type SidewaysCardiganGarmentStyle,
} from "./sidewaysCardiganConstructionIdentity";
import { formatRowsCount } from "./sidewaysCardiganDisplayFormat";

export const SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES =
  "non-positive-starting-stitches";
export const SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES =
  "non-positive-back-neck-stitches";
export const SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH = "back-neck-exceeds-length";
export const SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH = "armhole-exceeds-length";
export const SIDEWAYS_CARDIGAN_V_NECK_NOT_SLOPE = "v-neck-not-slope";

/** Short-row V shaping is opposite the carriage with manual wraps; COL/COR is not fixed. */
export const SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE =
  "Work each short-row shaping action opposite the carriage, using manual wraps. Do not assume a fixed COL or COR — the neckline may be on either side.";

export type SidewaysCardiganBodyInstructionError =
  | SidewaysCardiganBodyCalcError
  | {
      code: typeof SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES;
      message: string;
      garmentLengthStitches: number;
      vNeckDepthStitches: number;
      startingFrontStitches: number;
    }
  | {
      code: typeof SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES;
      message: string;
      backNeckDepthInches: number;
      backNeckDepthStitches: number;
    }
  | {
      code: typeof SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH;
      message: string;
      backNeckDepthStitches: number;
      garmentLengthStitches: number;
    }
  | {
      code: typeof SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH;
      message: string;
      armholeDepthStitches: number;
      garmentLengthStitches: number;
    }
  | {
      code: typeof SIDEWAYS_CARDIGAN_V_NECK_NOT_SLOPE;
      message: string;
      vNeckDepthStitches: number;
      halfNeckRows: number;
      shapingActions: number;
    };

export type SidewaysCardiganVNeckSchedule = {
  startStitches: number;
  endStitches: number;
  /** Even knitted-row count for this V (two rows per slope action). */
  rows: number;
  shapingActions: number;
  rowInterval: 2;
  /** Stitches returned from hold (increase) or placed in hold (decrease) on each slope action. */
  stitchesChangedOnAction: number[];
  workingStitchesAfterAction: number[];
  heldStitchesAfterAction: number[];
  /**
   * When true, the last two-row interval returns remaining held stitches after its first
   * knitted row and works the second row across full width (encloses wraps; no extra RC).
   */
  encloseHeldStitchesOnFinalRow: boolean;
};

export type SidewaysCardiganBodyInstructionStep = {
  id: string;
  order: number;
  summary: string;
  rows: number;
  stitchesBefore: number;
  stitchesAfter: number;
  rowCounterStart: number;
  rowCounterEnd: number;
};

export type SidewaysCardiganRowLandmarks = {
  endFirstVShaping: number;
  firstSideSeam: number;
  firstBackNeckEdge: number;
  secondBackNeckEdge: number;
  secondSideSeam: number;
  startFinalVShaping: number;
  endSecondVShaping: number;
  finalBindOff: number;
};

export type SidewaysCardiganSectionRowCounts = {
  firstVNeck: number;
  firstFrontShoulder: number;
  firstBackShoulder: number;
  backNeckOpening: number;
  secondBackShoulder: number;
  secondFrontShoulder: number;
  secondVNeck: number;
};

export type SidewaysCardiganBodyInstructions = {
  garmentStyle: SidewaysCardiganGarmentStyle;
  calc: SidewaysCardiganBodyCalc;
  startingFrontStitches: number;
  backNeckLiveStitches: number;
  firstV: SidewaysCardiganVNeckSchedule;
  secondV: SidewaysCardiganVNeckSchedule;
  increaseSequence: number[];
  decreaseSequence: number[];
  landmarks: SidewaysCardiganRowLandmarks;
  sectionRowCounts: SidewaysCardiganSectionRowCounts;
  steps: SidewaysCardiganBodyInstructionStep[];
};

export type SidewaysCardiganBodyInstructionResult =
  | { ok: true; instructions: SidewaysCardiganBodyInstructions }
  | { ok: false; error: SidewaysCardiganBodyInstructionError };

export function knittedArmholeSlitCount(
  garmentStyle: SidewaysCardiganGarmentStyle,
): 1 | 2 {
  return garmentStyle === "pullover" ? 1 : 2;
}

function stitchesAfterApplyingHoldDeltas(args: {
  startWorking: number;
  startHeld: number;
  deltas: readonly number[];
  returningFromHold: boolean;
}): { working: number[]; held: number[] } {
  const working: number[] = [];
  const held: number[] = [];
  let live = args.startWorking;
  let parked = args.startHeld;
  for (const delta of args.deltas) {
    if (args.returningFromHold) {
      live += delta;
      parked -= delta;
    } else {
      live -= delta;
      parked += delta;
    }
    working.push(live);
    held.push(parked);
  }
  return { working, held };
}

function buildVNeckSchedule(args: {
  startStitches: number;
  heldAtStart: number;
  endStitches: number;
  deltas: number[];
  rows: number;
  returningFromHold: boolean;
  encloseHeldStitchesOnFinalRow: boolean;
}): SidewaysCardiganVNeckSchedule {
  const after = stitchesAfterApplyingHoldDeltas({
    startWorking: args.startStitches,
    startHeld: args.heldAtStart,
    deltas: args.deltas,
    returningFromHold: args.returningFromHold,
  });
  return {
    startStitches: args.startStitches,
    endStitches: args.endStitches,
    rows: args.rows,
    shapingActions: args.deltas.length,
    rowInterval: 2,
    stitchesChangedOnAction: args.deltas,
    workingStitchesAfterAction: after.working,
    heldStitchesAfterAction: after.held,
    encloseHeldStitchesOnFinalRow: args.encloseHeldStitchesOnFinalRow,
  };
}

function step(args: {
  id: string;
  order: number;
  summary: string;
  rows: number;
  stitchesBefore: number;
  stitchesAfter: number;
  rowCounterStart: number;
}): SidewaysCardiganBodyInstructionStep {
  return {
    ...args,
    rowCounterEnd: args.rowCounterStart + args.rows,
  };
}

type StepPusher = (
  partial: Omit<SidewaysCardiganBodyInstructionStep, "rowCounterStart" | "rowCounterEnd">,
) => void;

function createStepPusher(steps: SidewaysCardiganBodyInstructionStep[]): {
  push: StepPusher;
  live: () => number;
} {
  let rc = 0;
  let live = 0;
  return {
    live: () => live,
    push: (partial) => {
      const built = step({ ...partial, rowCounterStart: rc });
      steps.push(built);
      rc = built.rowCounterEnd;
      live = built.stitchesAfter;
    },
  };
}

function cardiganLandmarks(
  sectionRowCounts: SidewaysCardiganSectionRowCounts,
): SidewaysCardiganRowLandmarks {
  const endFirstVShaping = sectionRowCounts.firstVNeck;
  const firstSideSeam = endFirstVShaping + sectionRowCounts.firstFrontShoulder;
  const firstBackNeckEdge = firstSideSeam + sectionRowCounts.firstBackShoulder;
  const secondBackNeckEdge = firstBackNeckEdge + sectionRowCounts.backNeckOpening;
  const secondSideSeam = secondBackNeckEdge + sectionRowCounts.secondBackShoulder;
  const startFinalVShaping = secondSideSeam + sectionRowCounts.secondFrontShoulder;
  const endSecondVShaping = startFinalVShaping + sectionRowCounts.secondVNeck;
  const finalBindOff = endSecondVShaping;
  return {
    endFirstVShaping,
    firstSideSeam,
    firstBackNeckEdge,
    secondBackNeckEdge,
    secondSideSeam,
    startFinalVShaping,
    endSecondVShaping,
    finalBindOff,
  };
}

function pulloverLandmarks(
  sectionRowCounts: SidewaysCardiganSectionRowCounts,
): SidewaysCardiganRowLandmarks {
  const startFinalVShaping = sectionRowCounts.firstFrontShoulder;
  const endFirstVShaping = startFinalVShaping + sectionRowCounts.firstVNeck;
  const endSecondVShaping = endFirstVShaping + sectionRowCounts.secondVNeck;
  const firstSideSeam = 0;
  const secondSideSeam = endSecondVShaping + sectionRowCounts.secondFrontShoulder;
  const firstBackNeckEdge = secondSideSeam + sectionRowCounts.firstBackShoulder;
  const secondBackNeckEdge = firstBackNeckEdge + sectionRowCounts.backNeckOpening;
  const finalBindOff = secondBackNeckEdge + sectionRowCounts.secondBackShoulder;
  return {
    endFirstVShaping,
    firstSideSeam,
    firstBackNeckEdge,
    secondBackNeckEdge,
    secondSideSeam,
    startFinalVShaping,
    endSecondVShaping,
    finalBindOff,
  };
}

function formatSlopeSequence(sequence: readonly number[]): string {
  return `[${sequence.join(", ")}]`;
}

function buildCardiganSteps(args: {
  calc: SidewaysCardiganBodyCalc;
  startingFrontStitches: number;
  fullWidth: number;
  vRows: number;
  backNeckRows: number;
  firstV: SidewaysCardiganVNeckSchedule;
  backNeckLiveStitches: number;
  increaseSequence: number[];
  decreaseSequence: number[];
  finalEdgeRc: number;
}): SidewaysCardiganBodyInstructionStep[] {
  const {
    calc,
    startingFrontStitches,
    fullWidth,
    vRows,
    backNeckRows,
    firstV,
    backNeckLiveStitches,
    increaseSequence,
    decreaseSequence,
    finalEdgeRc,
  } = args;
  const shoulder = calc.shoulders.firstFrontRows;
  const armhole = calc.armholeDepthStitches;
  const backNeck = calc.backNeckDepthStitches;
  const vSts = calc.vNeckDepthStitches;
  const actions = firstV.shapingActions;
  const steps: SidewaysCardiganBodyInstructionStep[] = [];
  const { push, live } = createStepPusher(steps);

  push({
    id: "scrap-on-full-width",
    order: 1,
    summary: `Scrap on across all ${fullWidth} needles`,
    rows: 0,
    stitchesBefore: 0,
    stitchesAfter: fullWidth,
  });
  push({
    id: "ravel-cord",
    order: 2,
    summary: "Knit one row of ravel cord",
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "closed-cast-on-full-width",
    order: 3,
    summary: `Work a closed cast-on with garment yarn across all ${fullWidth} needles`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "hold-neckline",
    order: 4,
    summary: `Place the ${vSts} neckline stitches in hold. Begin with ${startingFrontStitches} body stitches working`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: startingFrontStitches,
  });
  push({
    id: "first-v-neck",
    order: 5,
    summary: `Return neckline stitches from hold according to the ${actions}-action slope sequence ${formatSlopeSequence(increaseSequence)}, every other row (${startingFrontStitches} → ${fullWidth} working stitches). ${SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE}`,
    rows: vRows,
    stitchesBefore: live(),
    stitchesAfter: firstV.endStitches,
  });
  push({
    id: "first-front-shoulder",
    order: 6,
    summary: `Knit ${shoulder} rows (first-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-armhole-slit",
    order: 7,
    summary: `First side seam: bind off ${armhole} stitches, cast on ${armhole} stitches (knitted armhole slit)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-back-shoulder",
    order: 8,
    summary: `Knit ${shoulder} rows (first-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "bind-off-back-neck",
    order: 9,
    summary: `Bind off ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "back-neck-opening",
    order: 10,
    summary: `Knit ${backNeckRows} rows (back-neck opening, ${backNeckLiveStitches} stitches)`,
    rows: backNeckRows,
    stitchesBefore: live(),
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "cast-on-back-neck",
    order: 11,
    summary: `Cast on ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-back-shoulder",
    order: 12,
    summary: `Knit ${shoulder} rows (second-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-armhole-slit",
    order: 13,
    summary: `Second side seam: bind off ${armhole} stitches, cast on ${armhole} stitches (knitted armhole slit)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-front-shoulder",
    order: 14,
    summary: `Knit ${shoulder} rows (second-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-v-neck",
    order: 15,
    summary: `Place neckline stitches into hold according to the reversed ${actions}-action slope sequence ${formatSlopeSequence(decreaseSequence)}, every other row. After the final decrease action, ${startingFrontStitches} body stitches are working and ${vSts} neckline stitches are held. After the first row of that final two-row interval, return all held stitches to work and knit the second row across all ${fullWidth} stitches to enclose the wraps. End at RC ${finalEdgeRc}, not RC ${finalEdgeRc + 1}. ${SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE}`,
    rows: vRows,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "bind-off-full-width",
    order: 16,
    summary: `Bind off all ${fullWidth} stitches loosely`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: 0,
  });
  return steps;
}

function buildPulloverSteps(args: {
  calc: SidewaysCardiganBodyCalc;
  vPointStitches: number;
  fullWidth: number;
  vRows: number;
  backNeckRows: number;
  firstV: SidewaysCardiganVNeckSchedule;
  secondV: SidewaysCardiganVNeckSchedule;
  backNeckLiveStitches: number;
  increaseSequence: number[];
  decreaseSequence: number[];
}): SidewaysCardiganBodyInstructionStep[] {
  const {
    calc,
    vPointStitches,
    fullWidth,
    vRows,
    backNeckRows,
    firstV,
    secondV,
    backNeckLiveStitches,
    increaseSequence,
    decreaseSequence,
  } = args;
  const shoulder = calc.shoulders.firstFrontRows;
  const armhole = calc.armholeDepthStitches;
  const backNeck = calc.backNeckDepthStitches;
  const actions = firstV.shapingActions;
  const steps: SidewaysCardiganBodyInstructionStep[] = [];
  const { push, live } = createStepPusher(steps);

  push({
    id: "cast-on-side-seam",
    order: 1,
    summary: `Cast on ${fullWidth} stitches (side seam)`,
    rows: 0,
    stitchesBefore: 0,
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-front-shoulder",
    order: 2,
    summary: `Knit ${shoulder} rows (first-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-v-neck",
    order: 3,
    summary: `Place neckline stitches into hold according to the reversed ${actions}-action slope sequence ${formatSlopeSequence(decreaseSequence)}, every other row (${fullWidth} → ${vPointStitches} working stitches), finishing at the center-front V point. ${SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE}`,
    rows: vRows,
    stitchesBefore: live(),
    stitchesAfter: firstV.endStitches,
  });
  push({
    id: "second-v-neck",
    order: 4,
    summary: `Return neckline stitches from hold according to the ${actions}-action slope sequence ${formatSlopeSequence(increaseSequence)}, every other row (${vPointStitches} → ${fullWidth} working stitches). ${SIDEWAYS_V_NECK_SHAPING_CARRIAGE_NOTE}`,
    rows: vRows,
    stitchesBefore: live(),
    stitchesAfter: secondV.endStitches,
  });
  push({
    id: "second-front-shoulder",
    order: 5,
    summary: `Knit ${shoulder} rows (second-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "knitted-armhole-slit",
    order: 6,
    summary: `Opposite side seam: bind off ${armhole} stitches, cast on ${armhole} stitches (knitted armhole slit)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-back-shoulder",
    order: 7,
    summary: `Knit ${shoulder} rows (first-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "bind-off-back-neck",
    order: 8,
    summary: `Bind off ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "back-neck-opening",
    order: 9,
    summary: `Knit ${backNeckRows} rows (back-neck opening, ${backNeckLiveStitches} stitches)`,
    rows: backNeckRows,
    stitchesBefore: live(),
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "cast-on-back-neck",
    order: 10,
    summary: `Cast on ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-back-shoulder",
    order: 11,
    summary: `Knit ${shoulder} rows (second-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "bind-off-side-seam",
    order: 12,
    summary: `Bind off ${fullWidth} stitches (original side seam)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: 0,
  });
  return steps;
}

/** Every-other-row short-row actions available in an even V-neck section. */
export function sidewaysVNeckShapingActions(halfNeckRows: number): number {
  return Math.ceil(halfNeckRows / 2);
}

/**
 * Distribute V-neck-depth stitches across every-other-row actions.
 * Compares stitches to action count, not to the half-neck row count.
 */
export function buildSidewaysVNeckSlopeSequence(
  vNeckDepthStitches: number,
  halfNeckRows: number,
):
  | { ok: true; sequence: number[]; shapingActions: number; rowInterval: 2 }
  | {
      ok: false;
      vNeckDepthStitches: number;
      halfNeckRows: number;
      shapingActions: number;
    } {
  const shapingActions = sidewaysVNeckShapingActions(halfNeckRows);
  if (
    !Number.isInteger(vNeckDepthStitches) ||
    vNeckDepthStitches < 1 ||
    !Number.isInteger(halfNeckRows) ||
    halfNeckRows < 2 ||
    halfNeckRows % 2 !== 0 ||
    vNeckDepthStitches < shapingActions
  ) {
    return {
      ok: false,
      vNeckDepthStitches,
      halfNeckRows,
      shapingActions,
    };
  }
  return {
    ok: true,
    sequence: distributeTotalAcrossRows(vNeckDepthStitches, shapingActions),
    shapingActions,
    rowInterval: 2,
  };
}

export function buildSidewaysCardiganBodyInstructions(
  input: SidewaysCardiganBodyCalcInput,
  garmentStyle: SidewaysCardiganGarmentStyle | unknown = SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT,
): SidewaysCardiganBodyInstructionResult {
  const resolvedStyle =
    parseSidewaysCardiganGarmentStyle(garmentStyle) ?? SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT;
  const calcResult = calculateSidewaysCardiganBody(input);
  if (!calcResult.ok) return calcResult;

  const { calc } = calcResult;
  const startingFrontStitches = calc.garmentLengthStitches - calc.vNeckDepthStitches;
  if (startingFrontStitches <= 0) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES,
        message:
          "V-neck depth leaves no stitches at the center-front edge. Make the V-neck shallower or lengthen the garment.",
        garmentLengthStitches: calc.garmentLengthStitches,
        vNeckDepthStitches: calc.vNeckDepthStitches,
        startingFrontStitches,
      },
    };
  }

  if (calc.backNeckDepthStitches <= 0) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES,
        message:
          "The back-neck depth from the sizing chart did not produce a usable stitch count. Check the back-neck measurement and stitch gauge.",
        backNeckDepthInches: calc.backNeckDepthInches,
        backNeckDepthStitches: calc.backNeckDepthStitches,
      },
    };
  }

  if (calc.backNeckDepthStitches >= calc.garmentLengthStitches) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH,
        message:
          "Back-neck depth is too deep for this garment length. Reduce the back-neck depth or lengthen the garment.",
        backNeckDepthStitches: calc.backNeckDepthStitches,
        garmentLengthStitches: calc.garmentLengthStitches,
      },
    };
  }

  if (calc.armholeDepthStitches >= calc.garmentLengthStitches) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH,
        message:
          "The armhole slit is deeper than the garment length. Reduce the finished upper arm or lengthen the garment.",
        armholeDepthStitches: calc.armholeDepthStitches,
        garmentLengthStitches: calc.garmentLengthStitches,
      },
    };
  }

  const vRows = calc.halfNeckRows;
  const backNeckRows = calc.backNeckOpeningRows;
  const slope = buildSidewaysVNeckSlopeSequence(calc.vNeckDepthStitches, vRows);
  if (!slope.ok) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_V_NECK_NOT_SLOPE,
        message:
          "There are not enough V-neck stitches to work short-row shaping every other row across this neck opening. Deepen the V-neck or narrow the neck opening.",
        vNeckDepthStitches: calc.vNeckDepthStitches,
        halfNeckRows: vRows,
        shapingActions: slope.shapingActions,
      },
    };
  }
  const increaseSequence = slope.sequence;
  const decreaseSequence = [...increaseSequence].reverse();
  const fullWidth = calc.garmentLengthStitches;
  const isPullover = resolvedStyle === "pullover";
  const firstV = isPullover
    ? buildVNeckSchedule({
        startStitches: fullWidth,
        heldAtStart: 0,
        endStitches: startingFrontStitches,
        deltas: decreaseSequence,
        rows: vRows,
        returningFromHold: false,
        encloseHeldStitchesOnFinalRow: false,
      })
    : buildVNeckSchedule({
        startStitches: startingFrontStitches,
        heldAtStart: calc.vNeckDepthStitches,
        endStitches: fullWidth,
        deltas: increaseSequence,
        rows: vRows,
        returningFromHold: true,
        encloseHeldStitchesOnFinalRow: false,
      });
  const secondV = isPullover
    ? buildVNeckSchedule({
        startStitches: startingFrontStitches,
        heldAtStart: calc.vNeckDepthStitches,
        endStitches: fullWidth,
        deltas: increaseSequence,
        rows: vRows,
        returningFromHold: true,
        encloseHeldStitchesOnFinalRow: false,
      })
    : buildVNeckSchedule({
        startStitches: fullWidth,
        heldAtStart: 0,
        endStitches: startingFrontStitches,
        deltas: decreaseSequence,
        rows: vRows,
        returningFromHold: false,
        encloseHeldStitchesOnFinalRow: true,
      });

  const seq = calc.bodyRowSequence;
  const sectionRowCounts: SidewaysCardiganSectionRowCounts = {
    firstVNeck: seq.firstFrontVNeckShapingRows,
    firstFrontShoulder: seq.firstFrontShoulderRows,
    firstBackShoulder: seq.firstBackShoulderRows,
    backNeckOpening: seq.backNeckOpeningRows,
    secondBackShoulder: seq.secondBackShoulderRows,
    secondFrontShoulder: seq.secondFrontShoulderRows,
    secondVNeck: seq.secondFrontVNeckShapingRows,
  };

  const landmarks = isPullover
    ? pulloverLandmarks(sectionRowCounts)
    : cardiganLandmarks(sectionRowCounts);
  const backNeckLiveStitches = fullWidth - calc.backNeckDepthStitches;
  const steps = isPullover
    ? buildPulloverSteps({
        calc,
        vPointStitches: startingFrontStitches,
        fullWidth,
        vRows,
        backNeckRows,
        firstV,
        secondV,
        backNeckLiveStitches,
        increaseSequence,
        decreaseSequence,
      })
    : buildCardiganSteps({
        calc,
        startingFrontStitches,
        fullWidth,
        vRows,
        backNeckRows,
        firstV,
        backNeckLiveStitches,
        increaseSequence,
        decreaseSequence,
        finalEdgeRc: landmarks.finalBindOff,
      });

  return {
    ok: true,
    instructions: {
      garmentStyle: resolvedStyle,
      calc,
      startingFrontStitches,
      backNeckLiveStitches,
      firstV,
      secondV,
      increaseSequence,
      decreaseSequence,
      landmarks,
      sectionRowCounts,
      steps,
    },
  };
}

export function renderSidewaysCardiganBodySequenceHtml(
  instructions: SidewaysCardiganBodyInstructions,
): string {
  const isPullover = instructions.garmentStyle === "pullover";
  const styleLabel = SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[instructions.garmentStyle];
  const intro = isPullover
    ? `${styleLabel}: starts at a side seam and has one knitted armhole slit. The beginning and ending edges form the other side seam. Seam from the hem toward the underarm, leaving the calculated armhole depth open.`
    : `${styleLabel}: starts at center front and has two knitted armhole slits.`;
  const items = instructions.steps
    .map((s) => `<li>${escapeHtml(s.summary)}</li>`)
    .join("");
  const marks = isPullover
    ? [
        ["Start (side seam)", instructions.landmarks.firstSideSeam],
        ["Start first V", instructions.landmarks.startFinalVShaping],
        ["V point", instructions.landmarks.endFirstVShaping],
        ["End second V", instructions.landmarks.endSecondVShaping],
        ["Knitted armhole slit", instructions.landmarks.secondSideSeam],
        ["First back-neck edge", instructions.landmarks.firstBackNeckEdge],
        ["Second back-neck edge", instructions.landmarks.secondBackNeckEdge],
        ["Final edge", instructions.landmarks.finalBindOff],
      ]
    : [
        ["End first V", instructions.landmarks.endFirstVShaping],
        ["First side seam", instructions.landmarks.firstSideSeam],
        ["First back-neck edge", instructions.landmarks.firstBackNeckEdge],
        ["Second back-neck edge", instructions.landmarks.secondBackNeckEdge],
        ["Second side seam", instructions.landmarks.secondSideSeam],
        ["Start second V", instructions.landmarks.startFinalVShaping],
        ["Final edge", instructions.landmarks.finalBindOff],
      ];
  const landmarkItems = marks
    .map(
      ([label, rc]) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(String(label))}</dt><dd>RC ${rc}</dd></div>`,
    )
    .join("");
  const sections = isPullover
    ? [
        ["First-front shoulder", instructions.sectionRowCounts.firstFrontShoulder],
        ["First V-neck", instructions.sectionRowCounts.firstVNeck],
        ["Second V-neck", instructions.sectionRowCounts.secondVNeck],
        ["Second-front shoulder", instructions.sectionRowCounts.secondFrontShoulder],
        ["First-back shoulder", instructions.sectionRowCounts.firstBackShoulder],
        ["Back-neck opening", instructions.sectionRowCounts.backNeckOpening],
        ["Second-back shoulder", instructions.sectionRowCounts.secondBackShoulder],
      ]
    : [
        ["First V-neck", instructions.sectionRowCounts.firstVNeck],
        ["First-front shoulder", instructions.sectionRowCounts.firstFrontShoulder],
        ["First-back shoulder", instructions.sectionRowCounts.firstBackShoulder],
        ["Back-neck opening", instructions.sectionRowCounts.backNeckOpening],
        ["Second-back shoulder", instructions.sectionRowCounts.secondBackShoulder],
        ["Second-front shoulder", instructions.sectionRowCounts.secondFrontShoulder],
        ["Second V-neck", instructions.sectionRowCounts.secondVNeck],
      ];
  const sectionItems = sections
    .map(
      ([label, rows]) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(String(label))}</dt><dd>${rows} rows</dd></div>`,
    )
    .join("");
  const totalBust = formatRowsCount(instructions.calc.bust.actualTotalBustRows);
  return `<p class="sg-fit-size-copy sideways-body-style-note">${escapeHtml(intro)}</p><ol class="sideways-body-sequence">${items}</ol><p class="sg-fit-size-copy">Total bust rows: ${escapeHtml(totalBust)}.</p><dl class="print-summary-dl print-summary-dl--inline sideways-body-landmarks">${landmarkItems}</dl><dl class="print-summary-dl print-summary-dl--inline sideways-body-sections">${sectionItems}</dl>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
