/**
 * Cross shoulder on sweater Stitches & Rows diagrams.
 *
 * The finished width from one outer shoulder point to the other, including the
 * neck opening. It is the knitted width of the generated shoulder-line stitch
 * count (stitches divided by gauge). It is not the sizing-chart shoulder.
 *
 * A split half keeps that full width separate from the half on the needles.
 * Pieces without this span — sleeves, cardigan fronts, sideways bodies, hats,
 * and socks — do not receive the label.
 */

import type { MeasurementDisplayUnit } from "../patternMeasurementDisplayUnit";

export const CROSS_SHOULDER_NAME = "Cross shoulder";
/** Split half: the finished shoulder-to-shoulder width, with no dimension arrow. */
export const FULL_CROSS_SHOULDER_NAME = "Full cross shoulder";
export const HALF_PIECE_WIDTH_NAME = "Half piece";

export type SweaterShoulderSpanName =
  | typeof CROSS_SHOULDER_NAME
  | typeof FULL_CROSS_SHOULDER_NAME
  | typeof HALF_PIECE_WIDTH_NAME;

export type SweaterShoulderSpan = {
  name: SweaterShoulderSpanName;
  /** Already-rounded stitches for this span. */
  stitches: number;
  /** Knitted width in canonical inches: stitches / gauge. */
  inches: number;
};

export type SweaterCrossShoulderSpans = {
  /** Full outer-shoulder span, including the neck. Null when this piece has no such span. */
  crossShoulder: SweaterShoulderSpan | null;
  /** Drawn half, including its seam stitch. Null unless the piece is a split half. */
  halfPiece: SweaterShoulderSpan | null;
};

function positiveStitches(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function knittedInches(stitches: number, stitchesPerInch: number): number | null {
  if (!(stitchesPerInch > 0) || !Number.isFinite(stitchesPerInch)) return null;
  const inches = stitches / stitchesPerInch;
  return inches > 0 && Number.isFinite(inches) ? inches : null;
}

function span(
  name: SweaterShoulderSpanName,
  stitches: number | undefined,
  stitchesPerInch: number,
): SweaterShoulderSpan | null {
  const rounded = positiveStitches(stitches);
  if (rounded === null) return null;
  const inches = knittedInches(rounded, stitchesPerInch);
  if (inches === null) return null;
  return { name, stitches: rounded, inches };
}

/**
 * Build the spans from generated stitch counts.
 * `fullShoulderStitches` is the finished shoulder line and does not include
 * seam stitches. `halfPieceStitches` is the half on the needles and does.
 */
export function sweaterCrossShoulderSpans(input: {
  stitchesPerInch: number;
  /** True when the drawn piece runs from one outer shoulder to the other. */
  spansBothShoulders: boolean;
  fullShoulderStitches?: number;
  /** True for a center-seam half of a piece that does span both shoulders. */
  splitHalf?: boolean;
  halfPieceStitches?: number;
}): SweaterCrossShoulderSpans {
  const full = span(
    input.splitHalf ? FULL_CROSS_SHOULDER_NAME : CROSS_SHOULDER_NAME,
    input.fullShoulderStitches,
    input.stitchesPerInch,
  );
  if (input.splitHalf) {
    return {
      crossShoulder: full,
      halfPiece: span(HALF_PIECE_WIDTH_NAME, input.halfPieceStitches, input.stitchesPerInch),
    };
  }
  if (!input.spansBothShoulders) {
    return { crossShoulder: null, halfPiece: null };
  }
  return { crossShoulder: full, halfPiece: null };
}

/** One-decimal knitted width in the selected unit. Quarter-inch chart snap is not used. */
export function formatKnittedShoulderMeasurement(
  inches: number,
  unit: MeasurementDisplayUnit,
): string {
  if (!(inches > 0) || !Number.isFinite(inches)) return "";
  const converted = unit === "cm" ? inches * 2.54 : inches;
  const tenth = Math.round(converted * 10) / 10;
  const shown =
    Math.abs(tenth - Math.round(tenth)) < 1e-9 ? String(Math.round(tenth)) : String(tenth);
  return `${shown} ${unit}`;
}

export function shoulderSpanCaption(
  spanLabel: SweaterShoulderSpan,
  unit: MeasurementDisplayUnit,
): string {
  const measurement = formatKnittedShoulderMeasurement(spanLabel.inches, unit);
  return measurement ? `${spanLabel.name} ${measurement}` : spanLabel.name;
}

export type CrossShoulderPlacement = {
  captionY: number;
  lineY: number;
  neckLabelY: number;
};

/**
 * Keeps the cross-shoulder caption and its dimension line above the neck
 * label. The neck label moves down when the top of the diagram is crowded,
 * and it stays above the neck arrow and the shoulder stitch label.
 */
export function placeCrossShoulderAboveNeck(input: {
  neckLabelY: number;
  neckArrowY: number;
  shoulderLabelY: number;
  /** How far the neck label extends above its anchor. The dimension line stays above that. */
  neckRise?: number;
  top?: number;
  gap?: number;
}): CrossShoulderPlacement {
  const top = input.top ?? 16;
  const gap = input.gap ?? 28;
  const captionYDefault = top;
  const lineYDefault = captionYDefault + gap * 0.65;
  const lowestNeck = Math.min(input.neckArrowY - gap * 0.45, input.shoulderLabelY - gap);
  const wantedNeck = Math.max(input.neckLabelY, lineYDefault + gap * 0.85);
  const neckLabelY = wantedNeck <= lowestNeck ? wantedNeck : Math.max(input.neckLabelY, lowestNeck);
  if (input.neckRise === undefined) {
    return { captionY: captionYDefault, lineY: lineYDefault, neckLabelY };
  }
  const neckTop = neckLabelY - input.neckRise;
  const lineY = Math.min(lineYDefault, neckTop - 8);
  const captionY = Math.min(captionYDefault, lineY - 12);
  return { captionY, lineY, neckLabelY };
}

export type SplitShoulderPlacement = CrossShoulderPlacement & {
  halfLineY: number;
  halfCaptionY: number;
};

/**
 * Split half: “Full cross shoulder” is a caption with no arrow. The half-piece
 * label sits just above the only dimension arrow, across the drawn half.
 */
export function placeSplitShoulderLabels(input: {
  neckLabelY: number;
  neckArrowY: number;
  shoulderLabelY: number;
  /** Top edge of the neck label. The half-piece arrow stays above it. */
  neckClearY?: number;
  top?: number;
}): SplitShoulderPlacement {
  const captionY = input.top ?? 10;
  let halfLineY = captionY + 36;
  if (input.neckClearY !== undefined) {
    halfLineY = Math.min(halfLineY, Math.max(captionY + 30, input.neckClearY - 12));
  }
  const halfCaptionY = halfLineY - 11;
  const lowestNeck = Math.min(input.neckArrowY - 12, input.shoulderLabelY - 28);
  const wantedNeck = Math.max(input.neckLabelY, halfLineY + 18);
  const neckLabelY = wantedNeck <= lowestNeck ? wantedNeck : Math.max(input.neckLabelY, lowestNeck);
  return { captionY, lineY: halfLineY, halfLineY, halfCaptionY, neckLabelY };
}
