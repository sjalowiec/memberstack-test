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
  garmentStyle: SidewaysCardiganGarmentStyle;
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

export function knittedArmholeSlitCount(
  garmentStyle: SidewaysCardiganGarmentStyle,
): 1 | 2 {
  return garmentStyle === "pullover" ? 1 : 2;
}

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
  const finalBindOff = startFinalVShaping + sectionRowCounts.secondVNeck;
  return {
    endFirstVShaping,
    firstSideSeam,
    firstBackNeckEdge,
    secondBackNeckEdge,
    secondSideSeam,
    startFinalVShaping,
    finalBindOff,
  };
}

function pulloverLandmarks(
  sectionRowCounts: SidewaysCardiganSectionRowCounts,
): SidewaysCardiganRowLandmarks {
  const startFinalVShaping = sectionRowCounts.firstFrontShoulder;
  const endFirstVShaping = startFinalVShaping + sectionRowCounts.firstVNeck;
  const firstSideSeam = 0;
  const secondSideSeam =
    endFirstVShaping + sectionRowCounts.secondVNeck + sectionRowCounts.secondFrontShoulder;
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
    finalBindOff,
  };
}

function buildCardiganSteps(args: {
  calc: SidewaysCardiganBodyCalc;
  startingFrontStitches: number;
  fullWidth: number;
  neckRows: number;
  firstV: SidewaysCardiganVNeckSchedule;
  secondV: SidewaysCardiganVNeckSchedule;
  backNeckLiveStitches: number;
}): SidewaysCardiganBodyInstructionStep[] {
  const { calc, startingFrontStitches, fullWidth, neckRows, firstV, secondV, backNeckLiveStitches } =
    args;
  const shoulder = calc.shoulders.firstFrontRows;
  const armhole = calc.armholeDepthStitches;
  const backNeck = calc.backNeckDepthStitches;
  const steps: SidewaysCardiganBodyInstructionStep[] = [];
  const { push, live } = createStepPusher(steps);

  push({
    id: "cast-on-starting-front",
    order: 1,
    summary: `Cast on ${startingFrontStitches} stitches (center front)`,
    rows: 0,
    stitchesBefore: 0,
    stitchesAfter: startingFrontStitches,
  });
  push({
    id: "first-v-neck",
    order: 2,
    summary: `First V-neck: add ${calc.vNeckDepthStitches} stitches over ${neckRows} rows (${startingFrontStitches} → ${fullWidth})`,
    rows: neckRows,
    stitchesBefore: live(),
    stitchesAfter: firstV.endStitches,
  });
  push({
    id: "first-front-shoulder",
    order: 3,
    summary: `Knit ${shoulder} rows (first-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-armhole-slit",
    order: 4,
    summary: `First side seam: bind off ${armhole} stitches, cast on ${armhole} stitches (knitted armhole slit)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "first-back-shoulder",
    order: 5,
    summary: `Knit ${shoulder} rows (first-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "bind-off-back-neck",
    order: 6,
    summary: `Bind off ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "back-neck-opening",
    order: 7,
    summary: `Knit ${neckRows} rows (back-neck opening, ${backNeckLiveStitches} stitches)`,
    rows: neckRows,
    stitchesBefore: live(),
    stitchesAfter: backNeckLiveStitches,
  });
  push({
    id: "cast-on-back-neck",
    order: 8,
    summary: `Cast on ${backNeck} stitches (straight back neck)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-back-shoulder",
    order: 9,
    summary: `Knit ${shoulder} rows (second-back shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-armhole-slit",
    order: 10,
    summary: `Second side seam: bind off ${armhole} stitches, cast on ${armhole} stitches (knitted armhole slit)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-front-shoulder",
    order: 11,
    summary: `Knit ${shoulder} rows (second-front shoulder, ${fullWidth} stitches)`,
    rows: shoulder,
    stitchesBefore: live(),
    stitchesAfter: fullWidth,
  });
  push({
    id: "second-v-neck",
    order: 12,
    summary: `Second V-neck: remove ${calc.vNeckDepthStitches} stitches over ${neckRows} rows (${fullWidth} → ${startingFrontStitches})`,
    rows: neckRows,
    stitchesBefore: live(),
    stitchesAfter: secondV.endStitches,
  });
  push({
    id: "bind-off-starting-front",
    order: 13,
    summary: `Bind off ${startingFrontStitches} stitches (center front)`,
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
  neckRows: number;
  firstV: SidewaysCardiganVNeckSchedule;
  secondV: SidewaysCardiganVNeckSchedule;
  backNeckLiveStitches: number;
}): SidewaysCardiganBodyInstructionStep[] {
  const { calc, vPointStitches, fullWidth, neckRows, firstV, secondV, backNeckLiveStitches } = args;
  const shoulder = calc.shoulders.firstFrontRows;
  const armhole = calc.armholeDepthStitches;
  const backNeck = calc.backNeckDepthStitches;
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
    summary: `First V-neck: remove ${calc.vNeckDepthStitches} stitches over ${neckRows} rows (${fullWidth} → ${vPointStitches}), finishing at the center-front V point`,
    rows: neckRows,
    stitchesBefore: live(),
    stitchesAfter: firstV.endStitches,
  });
  push({
    id: "second-v-neck",
    order: 4,
    summary: `Second V-neck: add ${calc.vNeckDepthStitches} stitches over ${neckRows} rows (${vPointStitches} → ${fullWidth})`,
    rows: neckRows,
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
    summary: `Knit ${neckRows} rows (back-neck opening, ${backNeckLiveStitches} stitches)`,
    rows: neckRows,
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

  const neckRows = calc.neckOpeningRows;
  const increaseDeltas = distributeTotalAcrossRows(calc.vNeckDepthStitches, neckRows);
  const decreaseDeltas = [...increaseDeltas].reverse();
  const fullWidth = calc.garmentLengthStitches;
  const isPullover = resolvedStyle === "pullover";
  const firstV = isPullover
    ? buildVNeckSchedule({
        startStitches: fullWidth,
        endStitches: startingFrontStitches,
        deltas: decreaseDeltas,
        sign: -1,
      })
    : buildVNeckSchedule({
        startStitches: startingFrontStitches,
        endStitches: fullWidth,
        deltas: increaseDeltas,
        sign: 1,
      });
  const secondV = isPullover
    ? buildVNeckSchedule({
        startStitches: startingFrontStitches,
        endStitches: fullWidth,
        deltas: increaseDeltas,
        sign: 1,
      })
    : buildVNeckSchedule({
        startStitches: fullWidth,
        endStitches: startingFrontStitches,
        deltas: decreaseDeltas,
        sign: -1,
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
        neckRows,
        firstV,
        secondV,
        backNeckLiveStitches,
      })
    : buildCardiganSteps({
        calc,
        startingFrontStitches,
        fullWidth,
        neckRows,
        firstV,
        secondV,
        backNeckLiveStitches,
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
        ["Start first V shaping", instructions.landmarks.startFinalVShaping],
        ["Center-front V point", instructions.landmarks.endFirstVShaping],
        ["Knitted armhole slit", instructions.landmarks.secondSideSeam],
        ["First back-neck edge", instructions.landmarks.firstBackNeckEdge],
        ["Second back-neck edge", instructions.landmarks.secondBackNeckEdge],
        ["Final bind-off (original side seam)", instructions.landmarks.finalBindOff],
      ]
    : [
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
