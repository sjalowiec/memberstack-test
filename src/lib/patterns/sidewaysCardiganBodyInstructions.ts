/**
 * Numeric Sideways Cardigan body instruction model (no written knitting copy).
 *
 * V-neck stitch changes are spread with {@link distributeTotalAcrossRows} so the first V
 * adds exactly `vNeckDepthStitches` across exactly `neckOpeningRows`, and the second V is
 * that schedule reversed. {@link evenShapingSchedule} is not used: it encodes carriage-side
 * interval spacing and cannot place more shaping actions than rows.
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

export const SIDEWAYS_CARDIGAN_NON_POSITIVE_STARTING_STITCHES =
  "non-positive-starting-stitches";
export const SIDEWAYS_CARDIGAN_NON_POSITIVE_BACK_NECK_STITCHES =
  "non-positive-back-neck-stitches";
export const SIDEWAYS_CARDIGAN_BACK_NECK_EXCEEDS_LENGTH = "back-neck-exceeds-length";
export const SIDEWAYS_CARDIGAN_ARMHOLE_EXCEEDS_LENGTH = "armhole-exceeds-length";

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
    };

export type SidewaysCardiganVNeckSchedule = {
  startStitches: number;
  endStitches: number;
  rows: number;
  /** Stitches added (first V) or removed (second V) on each row. Length === rows. */
  stitchesChangedOnRow: number[];
  stitchesAfterRow: number[];
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
  calc: SidewaysCardiganBodyCalc;
  startingFrontStitches: number;
  backNeckLiveStitches: number;
  firstV: SidewaysCardiganVNeckSchedule;
  secondV: SidewaysCardiganVNeckSchedule;
  landmarks: SidewaysCardiganRowLandmarks;
  sectionRowCounts: SidewaysCardiganSectionRowCounts;
  steps: SidewaysCardiganBodyInstructionStep[];
};

export type SidewaysCardiganBodyInstructionResult =
  | { ok: true; instructions: SidewaysCardiganBodyInstructions }
  | { ok: false; error: SidewaysCardiganBodyInstructionError };

function stitchesAfterApplyingDeltas(
  startStitches: number,
  deltas: readonly number[],
  sign: 1 | -1,
): number[] {
  const out: number[] = [];
  let live = startStitches;
  for (const delta of deltas) {
    live += sign * delta;
    out.push(live);
  }
  return out;
}

function buildVNeckSchedule(args: {
  startStitches: number;
  endStitches: number;
  deltas: number[];
  sign: 1 | -1;
}): SidewaysCardiganVNeckSchedule {
  const stitchesAfterRow = stitchesAfterApplyingDeltas(args.startStitches, args.deltas, args.sign);
  return {
    startStitches: args.startStitches,
    endStitches: args.endStitches,
    rows: args.deltas.length,
    stitchesChangedOnRow: args.deltas,
    stitchesAfterRow,
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

export function buildSidewaysCardiganBodyInstructions(
  input: SidewaysCardiganBodyCalcInput,
): SidewaysCardiganBodyInstructionResult {
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

  const neckRows = calc.neckOpeningRows;
  const increaseDeltas = distributeTotalAcrossRows(calc.vNeckDepthStitches, neckRows);
  const decreaseDeltas = [...increaseDeltas].reverse();
  const fullWidth = calc.garmentLengthStitches;
  const firstV = buildVNeckSchedule({
    startStitches: startingFrontStitches,
    endStitches: fullWidth,
    deltas: increaseDeltas,
    sign: 1,
  });
  const secondV = buildVNeckSchedule({
    startStitches: fullWidth,
    endStitches: startingFrontStitches,
    deltas: decreaseDeltas,
    sign: -1,
  });

  const shoulder = calc.shoulders.firstFrontRows;
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

  const endFirstVShaping = sectionRowCounts.firstVNeck;
  const firstSideSeam = endFirstVShaping + sectionRowCounts.firstFrontShoulder;
  const firstBackNeckEdge = firstSideSeam + sectionRowCounts.firstBackShoulder;
  const secondBackNeckEdge = firstBackNeckEdge + sectionRowCounts.backNeckOpening;
  const secondSideSeam = secondBackNeckEdge + sectionRowCounts.secondBackShoulder;
  const startFinalVShaping = secondSideSeam + sectionRowCounts.secondFrontShoulder;
  const finalBindOff = startFinalVShaping + sectionRowCounts.secondVNeck;

  const landmarks: SidewaysCardiganRowLandmarks = {
    endFirstVShaping,
    firstSideSeam,
    firstBackNeckEdge,
    secondBackNeckEdge,
    secondSideSeam,
    startFinalVShaping,
    finalBindOff,
  };

  const backNeckLiveStitches = fullWidth - calc.backNeckDepthStitches;
  const armhole = calc.armholeDepthStitches;
  const backNeck = calc.backNeckDepthStitches;

  const steps: SidewaysCardiganBodyInstructionStep[] = [];
  let rc = 0;
  let live = 0;
  const push = (
    partial: Omit<SidewaysCardiganBodyInstructionStep, "rowCounterStart" | "rowCounterEnd">,
  ): void => {
    const built = step({ ...partial, rowCounterStart: rc });
    steps.push(built);
    rc = built.rowCounterEnd;
    live = built.stitchesAfter;
  };

  push({
    id: "cast-on-starting-front",
    order: 1,
    summary: `Cast on ${startingFrontStitches} stitches`,
    rows: 0,
    stitchesBefore: 0,
    stitchesAfter: startingFrontStitches,
  });
  push({
    id: "first-v-neck",
    order: 2,
    summary: `First V-neck: add ${calc.vNeckDepthStitches} stitches over ${neckRows} rows (${startingFrontStitches} → ${fullWidth})`,
    rows: neckRows,
    stitchesBefore: live,
    stitchesAfter: firstV.endStitches,
  });
  push({
    id: "first-front-shoulder",
    order: 3,
    summary: `Knit ${shoulder} rows (first-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-armhole-slit",
    order: 4,
    summary: `First side seam: bind off ${armhole} stitches, cast on ${armhole} stitches`,
    rows: 0,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-back-shoulder",
    order: 5,
    summary: `Knit ${shoulder} rows (first-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "bind-off-back-neck",
    order: 6,
    summary: `Bind off ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live,
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "back-neck-opening",
    order: 7,
    summary: `Knit ${neckRows} rows (back-neck opening, ${backNeckLiveStitches} stitches)`,
    rows: neckRows,
    stitchesBefore: live,
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "cast-on-back-neck",
    order: 8,
    summary: `Cast on ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-back-shoulder",
    order: 9,
    summary: `Knit ${shoulder} rows (second-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-armhole-slit",
    order: 10,
    summary: `Second side seam: bind off ${armhole} stitches, cast on ${armhole} stitches`,
    rows: 0,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-front-shoulder",
    order: 11,
    summary: `Knit ${shoulder} rows (second-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live,
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-v-neck",
    order: 12,
    summary: `Second V-neck: remove ${calc.vNeckDepthStitches} stitches over ${neckRows} rows (${fullWidth} → ${startingFrontStitches})`,
    rows: neckRows,
    stitchesBefore: live,
    stitchesAfter: secondV.endStitches,
  });
  push({
    id: "bind-off-starting-front",
    order: 13,
    summary: `Bind off ${startingFrontStitches} stitches`,
    rows: 0,
    stitchesBefore: live,
    stitchesAfter: 0,
  });

  return {
    ok: true,
    instructions: {
      calc,
      startingFrontStitches,
      backNeckLiveStitches,
      firstV,
      secondV,
      landmarks,
      sectionRowCounts,
      steps,
    },
  };
}

export function renderSidewaysCardiganBodySequenceHtml(
  instructions: SidewaysCardiganBodyInstructions,
): string {
  const items = instructions.steps
    .map((s) => `<li>${escapeHtml(s.summary)}</li>`)
    .join("");
  const marks = [
    ["End first V shaping", instructions.landmarks.endFirstVShaping],
    ["First side seam", instructions.landmarks.firstSideSeam],
    ["First back-neck edge", instructions.landmarks.firstBackNeckEdge],
    ["Second back-neck edge", instructions.landmarks.secondBackNeckEdge],
    ["Second side seam", instructions.landmarks.secondSideSeam],
    ["Start final V shaping", instructions.landmarks.startFinalVShaping],
    ["Final bind-off", instructions.landmarks.finalBindOff],
  ];
  const landmarkItems = marks
    .map(
      ([label, rc]) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(String(label))}</dt><dd>RC ${rc}</dd></div>`,
    )
    .join("");
  const sections = [
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
  return `<ol class="sideways-body-sequence">${items}</ol><dl class="print-summary-dl print-summary-dl--inline sideways-body-landmarks">${landmarkItems}</dl><dl class="print-summary-dl print-summary-dl--inline sideways-body-sections">${sectionItems}</dl>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
