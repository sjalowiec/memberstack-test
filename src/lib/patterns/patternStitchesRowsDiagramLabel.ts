/**
 * Count labels for generated Stitches & Rows diagrams.
 *
 * A measurement is attached only when the caller already knows what that span
 * is. This module does not divide stitches or rows by gauge.
 * Measurement text uses the Summary / Edit display rounding.
 */

import {
  formatMeasurementDisplayFromInches,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";

export type PatternDiagramCountKind = "sts" | "rows";

/** Canonical inches the pattern already uses for this span. Omit when the span is not identified. */
export function formatPatternDiagramMeasurement(
  inches: number | undefined,
  unit: MeasurementDisplayUnit,
): string {
  if (inches === undefined || !Number.isFinite(inches) || inches <= 0) return "";
  const n = formatMeasurementDisplayFromInches(inches, unit);
  if (!n) return "";
  return `${n} ${unit}`;
}

/**
 * `162 sts`, or `162 sts (27 in)` when a finished measurement was supplied.
 * An empty measurement leaves the count alone.
 */
export function formatPatternDiagramCountLabel(
  count: number,
  kind: PatternDiagramCountKind,
  measurement?: string | null,
): string {
  if (!Number.isFinite(count)) return "";
  const n = Math.max(0, Math.round(count));
  const base = `${n} ${kind}`;
  const measure = measurement?.trim() ?? "";
  if (!measure) return base;
  return `${base} (${measure})`;
}
