/**
 * Christmas Stocking sizing adapter over `public/data/sizing_xmas_stockings.json`.
 * Leg circumference is not stored. It always equals foot circumference.
 */

export const CHRISTMAS_STOCKING_SIZING_DATA_URL = "/data/sizing_xmas_stockings.json";

export type SockSizingChartRow = {
  size: string;
  label: string;
  extended_label: string;
  leg_length: number;
  foot_circumference: number;
  foot_length: number;
};

export type SockChartMeasurements = {
  size: string;
  label: string;
  extendedLabel: string;
  footCircumferenceInches: number;
  footLengthInches: number;
  legLengthInches: number;
  /** Locked to foot circumference. */
  defaultLegCircumferenceInches: number;
};

export type SockSizingAdapter = {
  rows: readonly SockSizingChartRow[];
  measurements: readonly SockChartMeasurements[];
};

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isChartRow(raw: unknown): raw is SockSizingChartRow {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.size === "string" &&
    o.size.trim().length > 0 &&
    typeof o.label === "string" &&
    typeof o.extended_label === "string" &&
    isFinitePositive(o.leg_length) &&
    isFinitePositive(o.foot_circumference) &&
    isFinitePositive(o.foot_length)
  );
}

function toMeasurements(row: SockSizingChartRow): SockChartMeasurements {
  return {
    size: row.size,
    label: row.label,
    extendedLabel: row.extended_label,
    footCircumferenceInches: row.foot_circumference,
    footLengthInches: row.foot_length,
    legLengthInches: row.leg_length,
    defaultLegCircumferenceInches: row.foot_circumference,
  };
}

export function createSockSizingAdapter(raw: unknown): SockSizingAdapter {
  const rows = Array.isArray(raw) ? raw.filter(isChartRow) : [];
  return {
    rows,
    measurements: rows.map(toMeasurements),
  };
}

export function findSockChartSize(
  adapter: SockSizingAdapter,
  sizeSel: string,
): SockChartMeasurements | null {
  const id = sizeSel.trim();
  if (!id || id === "custom") return null;
  return adapter.measurements.find((row) => row.size === id) ?? null;
}

export function sockSizeDisplayName(row: SockChartMeasurements): string {
  return row.extendedLabel || row.label || row.size;
}

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
