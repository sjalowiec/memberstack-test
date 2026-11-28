/**
 * Mitten counts for a slotted thumb and a gored thumb.
 * Stitch counts and finished measurements stay separate.
 * "Target knitted width" in the slot formula is a stitch count.
 * A gored thumb does not use that formula.
 */

import {
  calculateShortRowShaping,
  roundToEvenPreferUp,
  type ShortRowShaping,
} from "../sock/sockMath";
import {
  defaultHand2LengthInches,
  mittenSizingRow,
  type MittenSizingRow,
} from "./mittenSizingChart";

/** Nearest whole number. Halves round away from zero. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  return Math.sign(value) * Math.round(Math.abs(value));
}

export type MittenMeasurements = {
  cuffCircumferenceInches: number;
  cuffLengthInches: number;
  handCircumferenceInches: number;
  handLengthInches: number;
  /** Length from the slot to the closed fingertips. */
  hand2LengthInches: number;
  /** Web to tip. Gore length is not included, for either thumb style. */
  thumbLengthInches: number;
  /** Temporary comparison value until the circumference defaults are checked. */
  thumbCircumferenceInches: number;
};

export type MittenThumbStyle = "slotted" | "gored";

export type MittenCalcInput = MittenMeasurements & {
  /** Stitches per inch. Hat gauge entries are per 4 inches and are converted first. */
  stitchGaugePerInch: number;
  rowGaugePerInch: number;
  /** Omitted drafts stay on the approved slotted construction. */
  thumbStyle?: MittenThumbStyle;
};

export type GoreReturn = {
  needles: number;
  /** False when this return leaves no held needle to wrap. */
  wrap: boolean;
};

export type GoreThumbPlan = {
  /** Thumb circumference × stitch gauge, plus 2 seam stitches, rounded once. */
  pickupNeedles: number;
  firstEdgeStitches: number;
  otherEdgeStitches: number;
  /**
   * Rows between the lower and upper markers on each edge.
   * Half the thumb circumference, converted with {@link roundHalfUp}.
   */
  markerRows: number;
  startWorkingNeedles: number;
  heldEachSide: number;
  returns: GoreReturn[];
};

export type MittenThumbCounts = {
  /**
   * Thumb circumference × stitch gauge, plus the 2-stitch seam allowance.
   * This is a stitch count and may be fractional before rounding.
   */
  targetKnittedThumbStitches: number;
  /** Slotted thumbs only. A gored thumb leaves this at 0. */
  slotSts: number;
  thumbSts: number;
  /** Knitted rows from web to tip. Gore short rows are not subtracted. */
  thumbRows: number;
  thumbStyle: MittenThumbStyle;
  gore: GoreThumbPlan | null;
};

export type MittenCalc = MittenThumbCounts & {
  cuffSts: number;
  cuffRows: number;
  handSts: number;
  increaseSts: number;
  handLengthRows: number;
  hand2Rows: number;
  hand1Rows: number;
  fingertip: ShortRowShaping;
  straightRows: number;
  /** Hand counter after Hand 1 and the straight rows. Slot rows are not included. */
  handEndRc: number;
  stitchGaugePerInch: number;
  rowGaugePerInch: number;
  measurements: MittenMeasurements;
};

export type MittenCalcResult =
  | { ok: true; calc: MittenCalc }
  | { ok: false; message: string };

export function gaugePerInchFromPer4Inches(gaugePer4Inches: number): number {
  if (!(gaugePer4Inches > 0)) return 0;
  return gaugePer4Inches / 4;
}

/** 4 center needles when the bed is even, 3 when it is odd, without passing the needle count. */
export function goredStartWorkingNeedles(pickupNeedles: number): number {
  const preferred = pickupNeedles % 2 === 0 ? 4 : 3;
  return Math.min(preferred, pickupNeedles);
}

/**
 * Bring held needles back opposite the carriage, 2 at a time.
 * The last group on a side is smaller when fewer than 2 remain.
 * A return does not wrap once that side has no held needle left.
 */
export function goredThumbReturns(heldEachSide: number): GoreReturn[] {
  let left = heldEachSide;
  let right = heldEachSide;
  let side: "left" | "right" = "left";
  const returns: GoreReturn[] = [];
  while (left > 0 || right > 0) {
    const available = side === "left" ? left : right;
    if (available === 0) {
      side = side === "left" ? "right" : "left";
      continue;
    }
    const needles = Math.min(2, available);
    if (side === "left") left -= needles;
    else right -= needles;
    const remainingThisSide = side === "left" ? left : right;
    returns.push({ needles, wrap: remainingThisSide > 0 });
    side = side === "left" ? "right" : "left";
  }
  return returns;
}

/**
 * Share of the thumb circumference between the top of the cuff and the lower markers.
 * The same share is used for every size, including children and custom measurements.
 */
export const GORED_LOWER_MARKER_CIRCUMFERENCE_FRACTION = 0.15;

/** Rows from the top of the cuff to the lower gored-thumb markers. */
export function rowsFromCuffToLowerGoredMarkers(
  thumbCircumferenceInches: number,
  rowGaugePerInch: number,
): number {
  if (!(thumbCircumferenceInches > 0) || !(rowGaugePerInch > 0)) return 0;
  return roundHalfUp(
    thumbCircumferenceInches * GORED_LOWER_MARKER_CIRCUMFERENCE_FRACTION * rowGaugePerInch,
  );
}

export type GoredMarkerPlacement = {
  /** Rows from the top of the cuff to the lower markers. */
  rowsFromCuff: number;
  /** Rows between the lower and upper markers. */
  markerRows: number;
  /** Hand row counter at the lower markers. The counter starts at the top of the cuff. */
  lowerAt: number;
  /** Hand row counter at the upper markers. This is the thumb web. */
  upperAt: number;
  /** Straight rows after the upper markers and before the fingertip setup. */
  straightRowsAfterUpper: number;
};

/**
 * Lower markers sit 15% of the thumb circumference above the cuff.
 * Upper markers sit half a thumb circumference above that.
 * The rows after the upper markers change so the mitten length stays the same.
 */
export function goredMarkerPlacement(calc: MittenCalc): GoredMarkerPlacement | null {
  const gore = calc.gore;
  if (!gore) return null;
  const rowsFromCuff = rowsFromCuffToLowerGoredMarkers(
    calc.measurements.thumbCircumferenceInches,
    calc.rowGaugePerInch,
  );
  const lowerAt = rowsFromCuff;
  const upperAt = lowerAt + gore.markerRows;
  return {
    rowsFromCuff,
    markerRows: gore.markerRows,
    lowerAt,
    upperAt,
    straightRowsAfterUpper: calc.hand1Rows + calc.straightRows - upperAt,
  };
}

export function planGoredThumb(args: {
  thumbCircumferenceInches: number;
  thumbLengthInches: number;
  stitchGaugePerInch: number;
  rowGaugePerInch: number;
}): (GoreThumbPlan & { targetKnittedThumbStitches: number; thumbRows: number }) | null {
  const { thumbCircumferenceInches, thumbLengthInches, stitchGaugePerInch, rowGaugePerInch } =
    args;
  if (!(thumbCircumferenceInches > 0) || !(stitchGaugePerInch > 0) || !(rowGaugePerInch > 0)) {
    return null;
  }
  const targetKnittedThumbStitches = thumbCircumferenceInches * stitchGaugePerInch + 2;
  const pickupNeedles = roundHalfUp(targetKnittedThumbStitches);
  const markerRows = roundHalfUp((thumbCircumferenceInches / 2) * rowGaugePerInch);
  const thumbRows = roundHalfUp(thumbLengthInches * rowGaugePerInch);
  if (!(pickupNeedles >= 1) || !(markerRows >= 1) || !(thumbRows >= 1)) return null;
  const firstEdgeStitches = Math.ceil(pickupNeedles / 2);
  const otherEdgeStitches = pickupNeedles - firstEdgeStitches;
  const startWorkingNeedles = goredStartWorkingNeedles(pickupNeedles);
  const heldEachSide = (pickupNeedles - startWorkingNeedles) / 2;
  if (!Number.isInteger(heldEachSide) || heldEachSide < 0) return null;
  return {
    targetKnittedThumbStitches,
    thumbRows,
    pickupNeedles,
    firstEdgeStitches,
    otherEdgeStitches,
    markerRows,
    startWorkingNeedles,
    heldEachSide,
    returns: goredThumbReturns(heldEachSide),
  };
}

export function calculateThumbCounts(args: {
  thumbCircumferenceInches: number;
  thumbLengthInches: number;
  stitchGaugePerInch: number;
  rowGaugePerInch: number;
  thumbStyle?: MittenThumbStyle;
}): MittenThumbCounts | null {
  const { thumbCircumferenceInches, thumbLengthInches, stitchGaugePerInch, rowGaugePerInch } =
    args;
  const thumbStyle = args.thumbStyle === "gored" ? "gored" : "slotted";
  if (!(thumbCircumferenceInches > 0) || !(stitchGaugePerInch > 0) || !(rowGaugePerInch > 0)) {
    return null;
  }
  /** Rows for the web-to-tip thumb length. Gore short rows are not subtracted. */
  const thumbRows = roundHalfUp(thumbLengthInches * rowGaugePerInch);
  if (!(thumbRows >= 1)) return null;
  const targetKnittedThumbStitches = thumbCircumferenceInches * stitchGaugePerInch + 2;
  if (thumbStyle === "gored") {
    const gore = planGoredThumb(args);
    if (!gore) return null;
    return {
      targetKnittedThumbStitches: gore.targetKnittedThumbStitches,
      slotSts: 0,
      thumbSts: gore.pickupNeedles,
      thumbRows: gore.thumbRows,
      thumbStyle,
      gore,
    };
  }
  const slotSts = roundHalfUp((targetKnittedThumbStitches - 1) / 2);
  if (!(slotSts >= 1)) return null;
  const thumbSts = 2 * slotSts + 1;
  return {
    targetKnittedThumbStitches,
    slotSts,
    thumbSts,
    thumbRows,
    thumbStyle,
    gore: null,
  };
}

export function calculateMittenPattern(input: MittenCalcInput): MittenCalcResult {
  const stitchGaugePerInch = input.stitchGaugePerInch;
  const rowGaugePerInch = input.rowGaugePerInch;
  if (!(stitchGaugePerInch > 0) || !(rowGaugePerInch > 0)) {
    return { ok: false, message: "Enter a stitch gauge and a row gauge." };
  }
  const measurementFields: Array<[keyof MittenMeasurements, string]> = [
    ["cuffCircumferenceInches", "cuff circumference"],
    ["cuffLengthInches", "cuff length"],
    ["handCircumferenceInches", "hand circumference"],
    ["handLengthInches", "hand length"],
    ["hand2LengthInches", "hand length above the thumb"],
    ["thumbLengthInches", "thumb length"],
    ["thumbCircumferenceInches", "thumb circumference"],
  ];
  for (const [key, label] of measurementFields) {
    if (!(input[key] > 0)) {
      return { ok: false, message: `Enter a ${label} greater than zero.` };
    }
  }
  if (input.hand2LengthInches >= input.handLengthInches) {
    return {
      ok: false,
      message: "Hand length above the thumb must be shorter than the full hand length.",
    };
  }

  const cuffSts = roundToEvenPreferUp(input.cuffCircumferenceInches * stitchGaugePerInch);
  const cuffRows = roundToEvenPreferUp(input.cuffLengthInches * rowGaugePerInch);
  const handSts = roundToEvenPreferUp(input.handCircumferenceInches * stitchGaugePerInch);
  const handLengthRows = roundToEvenPreferUp(input.handLengthInches * rowGaugePerInch);
  const hand2Rows = roundToEvenPreferUp(input.hand2LengthInches * rowGaugePerInch);
  const hand1Rows = handLengthRows - hand2Rows;
  const increaseSts = handSts - cuffSts;
  if (!(cuffSts >= 2) || !(handSts >= 4)) {
    return { ok: false, message: "The stitch gauge produces too few stitches to knit a mitten." };
  }
  if (increaseSts < 0) {
    return {
      ok: false,
      message: "The hand stitch count is lower than the cuff. Widen the hand or narrow the cuff.",
    };
  }
  if (hand1Rows < 0 || hand1Rows % 2 !== 0) {
    return {
      ok: false,
      message: "Hand below the thumb rows must be an even number so the carriage returns to the right.",
    };
  }

  const fingertip = calculateShortRowShaping(handSts);
  if (!fingertip) {
    return { ok: false, message: "The hand stitch count cannot form equal fingertip halves." };
  }
  const straightRows = hand2Rows - fingertip.shortRowDepthRows;
  if (straightRows < 1) {
    return {
      ok: false,
      message:
        "Hand length above the thumb is shorter than the fingertip shaping. Lengthen that section.",
    };
  }
  if (straightRows % 2 !== 0) {
    return {
      ok: false,
      message:
        "Straight rows after the thumb opening must be even so the carriage returns to the right.",
    };
  }

  const thumbStyle = input.thumbStyle === "gored" ? "gored" : "slotted";
  const thumb = calculateThumbCounts({
    thumbCircumferenceInches: input.thumbCircumferenceInches,
    thumbLengthInches: input.thumbLengthInches,
    stitchGaugePerInch,
    rowGaugePerInch,
    thumbStyle,
  });
  if (!thumb) {
    return {
      ok: false,
      message:
        thumbStyle === "gored"
          ? "The thumb measurement cannot form a gored thumb."
          : "The thumb measurement cannot form a slotted thumb.",
    };
  }
  if (thumb.gore) {
    const rowsFromCuff = rowsFromCuffToLowerGoredMarkers(
      input.thumbCircumferenceInches,
      rowGaugePerInch,
    );
    if (rowsFromCuff + thumb.gore.markerRows > hand1Rows + straightRows) {
      return {
        ok: false,
        message:
          "The gored thumb opening is longer than the hand rows before the fingertips. Lengthen the hand or reduce the thumb circumference.",
      };
    }
  }

  return {
    ok: true,
    calc: {
      ...thumb,
      cuffSts,
      cuffRows,
      handSts,
      increaseSts,
      handLengthRows,
      hand2Rows,
      hand1Rows,
      fingertip,
      straightRows,
      handEndRc: hand1Rows + straightRows,
      stitchGaugePerInch,
      rowGaugePerInch,
      measurements: {
        cuffCircumferenceInches: input.cuffCircumferenceInches,
        cuffLengthInches: input.cuffLengthInches,
        handCircumferenceInches: input.handCircumferenceInches,
        handLengthInches: input.handLengthInches,
        hand2LengthInches: input.hand2LengthInches,
        thumbLengthInches: input.thumbLengthInches,
        thumbCircumferenceInches: input.thumbCircumferenceInches,
      },
    },
  };
}

export function measurementsFromSizingRow(
  row: MittenSizingRow,
  hand2LengthInches = defaultHand2LengthInches(row.handLengthInches),
): MittenMeasurements {
  return {
    cuffCircumferenceInches: row.cuffCircumferenceInches,
    cuffLengthInches: row.cuffLengthInches,
    handCircumferenceInches: row.handCircumferenceInches,
    handLengthInches: row.handLengthInches,
    hand2LengthInches,
    thumbLengthInches: row.thumbLengthInches,
    thumbCircumferenceInches: row.thumbCircumferenceInches,
  };
}

/** Woman Small at 7 stitches and 10 rows per inch (28 and 40 over 4 inches). */
export function womanSmallPreviewInput(): MittenCalcInput {
  const row = mittenSizingRow("woman_sm");
  if (!row) throw new Error("Woman Small is missing from the mitten chart.");
  return {
    ...measurementsFromSizingRow(row),
    stitchGaugePerInch: 7,
    rowGaugePerInch: 10,
  };
}

export function womanSmallPreviewCalc(): MittenCalc {
  const result = calculateMittenPattern(womanSmallPreviewInput());
  if (!result.ok) throw new Error(result.message);
  return result.calc;
}

export type MittenPhysicalLengths = {
  cuffLengthIn: number;
  hand1LengthIn: number;
  straightLengthIn: number;
  /** One full-width fingertip setup row. The row counter does not record it. */
  setupRowIn: number;
  fingertipDepthIn: number;
  /** Straight rows, the setup row, and the fingertip depth. */
  hand2LengthIn: number;
  totalLengthIn: number;
};

/**
 * Finished lengths from the knitted rows.
 * The requested measurements stay on {@link MittenCalc.measurements}.
 * The setup row is one row at the entered row gauge.
 */
export function mittenPhysicalLengths(calc: MittenCalc): MittenPhysicalLengths {
  const row = calc.rowGaugePerInch;
  const cuffLengthIn = calc.cuffRows / row;
  const hand1LengthIn = calc.hand1Rows / row;
  const straightLengthIn = calc.straightRows / row;
  const setupRowIn = 1 / row;
  const fingertipDepthIn = calc.fingertip.shortRowDepthRows / row;
  const hand2LengthIn = straightLengthIn + setupRowIn + fingertipDepthIn;
  return {
    cuffLengthIn,
    hand1LengthIn,
    straightLengthIn,
    setupRowIn,
    fingertipDepthIn,
    hand2LengthIn,
    totalLengthIn: cuffLengthIn + hand1LengthIn + hand2LengthIn,
  };
}

/** Trim to thousandths and keep at least one decimal place. */
export function formatMittenLengthInches(inches: number): string {
  if (!Number.isFinite(inches)) return "";
  const rounded = Math.round(inches * 1000) / 1000;
  const trimmed = rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return trimmed.includes(".") ? trimmed : `${trimmed}.0`;
}
