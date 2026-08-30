/**
 * Sock sizing adapter over the existing `public/data/sizing_socks.json` chart.
 *
 * Does not replace or rewrite the chart. Chart values are finished measurements
 * in inches (same convention as other KIN sizing JSON files). Knit It Now patterns
 * use desired finished measurements — this adapter does not add ease.
 *
 * Chart findings (do not silently "fix"):
 * - Rows keyed by `size`; primary selector is `foot_circumference`.
 * - Provides `foot_length` and `cuff_length` (treated as default finished leg length).
 * - Does **not** include leg/calf circumference, ankle circumference, heel depth, or toe depth.
 * - Woman Large and Man Small share foot circumference 9" but differ in foot length / cuff length.
 * - Child `extended_label` uses an en-dash in "6–10 years".
 */

export const SOCK_SIZING_DATA_URL = "/data/sizing_socks.json";

/** Raw row shape of `public/data/sizing_socks.json`. */
export type SockSizingChartRow = {
  size: string;
  label: string;
  extended_label: string;
  foot_length: number;
  foot_circumference: number;
  cuff_length: number;
};

export type SockChartMeasurements = {
  size: string;
  label: string;
  extendedLabel: string;
  /** Finished foot circumference (inches). Primary size selector. */
  footCircumferenceInches: number;
  footLengthInches: number;
  /** Chart `cuff_length` — default finished leg length. */
  legLengthInches: number;
  /**
   * Chart has no leg circumference. Prefill equals foot circumference so a
   * straight (unshaped) leg is the default until Perfect Fit overrides it.
   */
  defaultLegCircumferenceInches: number;
};

export type SockSizingAdapter = {
  rows: readonly SockSizingChartRow[];
  measurements: readonly SockChartMeasurements[];
};

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isSockSizingChartRow(raw: unknown): raw is SockSizingChartRow {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.size === "string" &&
    o.size.trim() !== "" &&
    typeof o.label === "string" &&
    typeof o.extended_label === "string" &&
    isFinitePositive(o.foot_length) &&
    isFinitePositive(o.foot_circumference) &&
    isFinitePositive(o.cuff_length)
  );
}

/** Coerce unknown JSON into chart rows, dropping malformed entries. */
export function parseSockSizingChart(raw: unknown): SockSizingChartRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSockSizingChartRow);
}

export function chartRowToMeasurements(row: SockSizingChartRow): SockChartMeasurements {
  return {
    size: row.size,
    label: row.label,
    extendedLabel: row.extended_label,
    footCircumferenceInches: row.foot_circumference,
    footLengthInches: row.foot_length,
    legLengthInches: row.cuff_length,
    defaultLegCircumferenceInches: row.foot_circumference,
  };
}

export function createSockSizingAdapter(raw: unknown): SockSizingAdapter {
  const rows = parseSockSizingChart(raw);
  return {
    rows,
    measurements: rows.map(chartRowToMeasurements),
  };
}

export function findSockChartSize(
  adapter: SockSizingAdapter,
  sizeId: string,
): SockChartMeasurements | null {
  const id = sizeId.trim();
  if (!id || id === "custom") return null;
  return adapter.measurements.find((row) => row.size === id) ?? null;
}

export function sockSizeDisplayName(row: SockChartMeasurements): string {
  return row.extendedLabel || row.label || row.size;
}

/**
 * Builder option label. Size is identified by foot circumference; other chart
 * measurements are available for later Perfect Fit prefills.
 */
export function buildSockSizeOptionLabel(
  row: SockChartMeasurements,
  displayUnit: "inches" | "cm" = "inches",
  inchToCm: (inches: number) => number = (n) => Math.round(n * 2.54),
): string {
  const name = sockSizeDisplayName(row);
  const circ =
    displayUnit === "inches"
      ? `${row.footCircumferenceInches}" foot circumference`
      : `${inchToCm(row.footCircumferenceInches)} cm foot circumference`;
  return `${name} — ${circ}`;
}

export function listSockSizingOptions(
  adapter: SockSizingAdapter,
  displayUnit: "inches" | "cm" = "inches",
): Array<SockChartMeasurements & { optionLabel: string }> {
  return adapter.measurements.map((row) => ({
    ...row,
    optionLabel: buildSockSizeOptionLabel(row, displayUnit),
  }));
}

/** Chart columns that exist vs Basic Sock inputs that must come from elsewhere. */
export const SOCK_CHART_FIELD_NOTES = {
  present: ["size", "label", "extended_label", "foot_length", "foot_circumference", "cuff_length"],
  missing: ["leg_circumference", "ankle_circumference", "heel_depth", "toe_depth"],
  overlappingFootCircumferenceSizes: ["woman_lg", "man_sm"],
} as const;
