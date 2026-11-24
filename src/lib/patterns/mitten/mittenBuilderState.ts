import type { MittenThumbStyle } from "./mittenMath";
import { draftFromSizingRow, type MittenDraft } from "./mittenDraft";
import { mittenSizingRow } from "./mittenSizingChart";

export const MITTEN_BUILDER_STEPS = [
  { step: 1, label: "Size" },
  { step: 2, label: "Thumb" },
  { step: 3, label: "Gauge" },
] as const;

export function mittenSizeStepComplete(sizeId: string): boolean {
  return mittenSizingRow(sizeId.trim()) !== null;
}

export function mittenThumbStepComplete(thumbStyle: string): boolean {
  return thumbStyle === "slotted" || thumbStyle === "gored";
}

export function mittenGaugeStepComplete(stitchGaugePer4: string, rowGaugePer4: string): boolean {
  const stitch = Number(stitchGaugePer4.trim());
  const row = Number(rowGaugePer4.trim());
  return stitch > 0 && row > 0;
}

export function mittenBuilderReady(input: {
  sizeId: string;
  thumbStyle: string;
  stitchGaugePer4: string;
  rowGaugePer4: string;
}): boolean {
  return (
    mittenSizeStepComplete(input.sizeId) &&
    mittenThumbStepComplete(input.thumbStyle) &&
    mittenGaugeStepComplete(input.stitchGaugePer4, input.rowGaugePer4)
  );
}

function keepMeasurement(previous: string | undefined, chart: string): string {
  const value = previous?.trim() ?? "";
  return value ? value : chart;
}

/**
 * A chart size loads its measurements. Choosing the same size again keeps
 * measurements the knitter already changed on Summary/Edit.
 */
export function draftForBuilderSize(options: {
  sizeId: string;
  previous: MittenDraft | null;
  stitchGaugePer4: string;
  rowGaugePer4: string;
  thumbStyle: MittenThumbStyle | "";
}): MittenDraft | null {
  const row = mittenSizingRow(options.sizeId.trim());
  if (!row) return null;
  const chosen = options.thumbStyle === "gored" || options.thumbStyle === "slotted";
  const next = draftFromSizingRow(row, {
    stitchGaugePer4: options.stitchGaugePer4,
    rowGaugePer4: options.rowGaugePer4,
    thumbStyle: options.thumbStyle === "gored" ? "gored" : "slotted",
  });
  if (!chosen) delete next.thumbStyle;
  if (options.previous?.sizeId === row.size) {
    next.cuffCircumference = keepMeasurement(options.previous.cuffCircumference, next.cuffCircumference);
    next.cuffLength = keepMeasurement(options.previous.cuffLength, next.cuffLength);
    next.handCircumference = keepMeasurement(options.previous.handCircumference, next.handCircumference);
    next.handLength = keepMeasurement(options.previous.handLength, next.handLength);
    next.hand2Length = keepMeasurement(options.previous.hand2Length, next.hand2Length);
    next.thumbLength = keepMeasurement(options.previous.thumbLength, next.thumbLength);
    next.thumbCircumference = keepMeasurement(
      options.previous.thumbCircumference,
      next.thumbCircumference,
    );
  }
  if (options.previous?.patternProject) next.patternProject = options.previous.patternProject;
  return next;
}
