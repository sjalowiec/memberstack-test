/**
 * Stitches & Rows diagram labels.
 *
 * Line 1 is the stitch or row count. Line 2, when a finished measurement
 * exists, is that measurement in smaller type. Counts stay alone when the
 * span has no measurement. This block does not divide by gauge.
 */

import {
  formatMeasurementDisplayFromInches,
  type MeasurementDisplayUnit,
} from "../patternMeasurementDisplayUnit";

export type PatternDiagramCountKind = "sts" | "rows";

export type StitchesRowsDiagramLabel = {
  /** `162 sts` or `95 rows`. */
  count: string;
  /** `23 in` or `9.5 cm`. Empty when no measurement was supplied. */
  measure: string;
};

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

/** Count only: `162 sts` or `95 rows`. */
export function formatPatternDiagramCountLabel(count: number, kind: PatternDiagramCountKind): string {
  if (!Number.isFinite(count)) return "";
  const n = Math.max(0, Math.round(count));
  return `${n} ${kind}`;
}

export function stitchesRowsDiagramLabel(
  count: number,
  kind: PatternDiagramCountKind,
  measurement?: string | null,
): StitchesRowsDiagramLabel {
  return {
    count: formatPatternDiagramCountLabel(count, kind),
    measure: measurement?.trim() ?? "",
  };
}

export function stitchesRowsDiagramLabelFromInches(
  count: number,
  kind: PatternDiagramCountKind,
  inches: number | undefined,
  unit: MeasurementDisplayUnit,
): StitchesRowsDiagramLabel {
  return stitchesRowsDiagramLabel(count, kind, formatPatternDiagramMeasurement(inches, unit));
}

/** Model/storage form. Renderers split this into the two visual lines. */
export function formatStitchesRowsDiagramLabel(
  count: number,
  kind: PatternDiagramCountKind,
  measurement?: string | null,
): string {
  const label = stitchesRowsDiagramLabel(count, kind, measurement);
  if (!label.count) return "";
  return label.measure ? `${label.count}\n${label.measure}` : label.count;
}

export function parseStitchesRowsDiagramLabel(label: string): StitchesRowsDiagramLabel {
  const [count = "", measure = ""] = label.split("\n");
  return { count: count.trim(), measure: measure.trim() };
}

export function escapeDiagramText(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Two associated lines. The measurement uses a smaller size and stays on the
 * same anchor as the count.
 */
export function stitchesRowsLabelMarkup(options: {
  label: string;
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  fill: string;
  countSize: number;
  measureSize: number;
  fontFamily: string;
  lineGap?: number;
  extra?: string;
  transform?: string;
  fmt?: (n: number) => string;
}): string {
  const parsed = parseStitchesRowsDiagramLabel(options.label);
  if (!parsed.count && !parsed.measure) return "";
  const fmt = options.fmt ?? ((n: number) => String(Math.round(n * 100) / 100));
  const anchor = options.anchor ?? "middle";
  const gap = options.lineGap ?? Math.round(options.countSize * 0.95);
  const x = fmt(options.x);
  const transform = options.transform ? ` transform="${options.transform}"` : "";
  const extra = options.extra ?? "";
  const lines = parsed.measure
    ? [
        { text: parsed.count, size: options.countSize, dy: 0 },
        { text: parsed.measure, size: options.measureSize, dy: gap },
      ]
    : [{ text: parsed.count, size: options.countSize, dy: 0 }];
  const tspans = lines
    .map(
      (line) =>
        `<tspan x="${x}" dy="${line.dy}" font-size="${line.size}">${escapeDiagramText(line.text)}</tspan>`,
    )
    .join("");
  return `<text${extra}${transform} x="${x}" y="${fmt(options.y)}" text-anchor="${anchor}" fill="${options.fill}" font-family="${options.fontFamily}" font-size="${options.countSize}">${tspans}</text>`;
}
