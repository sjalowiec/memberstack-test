/**
 * Repair historical 10× measurement overrides on saved patterns.
 *
 * Some older saved projects stored diagram overrides at about 10× the real inch value
 * (the centimeter figure with the decimal point removed, then divided by 2.54).
 * Example: Women's size 7 relaxed straight bust 45″ was stored as 450″ and displayed as 1143 cm.
 *
 * A saved override is replaced with the chart/default inches for this pattern's audience, size,
 * fit, and body shape only when it is approximately 10× that default. Other overrides, including
 * large legitimate custom measurements, are left as stored. This does not change how a new
 * pattern converts centimeters to inches.
 */
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";
import { inchesToCmRounded } from "./patternMeasurementDisplayUnit";
import { normalizeSleevelessAudience } from "./patternStorage";
import { diagramOverrideDefaultsFromChartRow } from "./customBuildMeasurementOverrideReconcile";
import {
  findExpressChartRow,
  normalizeChartRowSize,
} from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import missesChart from "../../../public/data/sizing_sweaters_misses.json";
import plusChart from "../../../public/data/sizing_sweaters_plus.json";
import menChart from "../../../public/data/sizing_sweaters_men.json";
import kidsChart from "../../../public/data/sizing_sweaters_kids.json";
import babyChart from "../../../public/data/sizing_sweaters_baby.json";

const INCH_TO_CM = 2.54;

/** How close a stored inch value must be to 10× the chart default (or to the decimal-stripped cm path). */
const TEN_TIMES_RELATIVE_TOLERANCE = 0.015;

const SLEEVE_OVERRIDE_KEYS = ["upperArm", "sleeveLength", "wrist", "cuffDepth"] as const;

const BUNDLED_CHART_ROWS: Record<string, ChartRow[]> = {
  misses: missesChart as ChartRow[],
  plus: plusChart as ChartRow[],
  men: menChart as ChartRow[],
  kids: kidsChart as ChartRow[],
  baby: babyChart as ChartRow[],
};

export type HistoricalTenTimesRepairContext = {
  audience: string;
  selectedSize: string;
  fitPreference: string;
  bodyShape?: string;
  dropShoulder?: boolean;
  /** Chart row already resolved by the caller. When omitted, the sweater chart for `audience` is used. */
  chartRow?: ChartRow | null;
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  return {};
}

function parsePositiveInches(raw: unknown): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : undefined;
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseFloat(trimmed.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function relativeClose(stored: number, target: number): boolean {
  const scale = Math.max(Math.abs(stored), Math.abs(target));
  if (!(scale > 0)) return false;
  return Math.abs(stored - target) / scale <= TEN_TIMES_RELATIVE_TOLERANCE;
}

/**
 * True when `storedInches` is the historical 10× corruption of `expectedInches`.
 * Matches both an exact ×10 and the old centimeter decimal-strip (114.3 cm stored as 1143 cm).
 */
export function isHistoricalTenTimesMeasurementOverride(
  storedInches: number,
  expectedInches: number,
): boolean {
  if (!(storedInches > 0) || !(expectedInches > 0)) return false;
  const ratio = storedInches / expectedInches;
  if (ratio < 9.5 || ratio > 10.5) return false;
  const exactTen = expectedInches * 10;
  const strippedCmAsInches = (inchesToCmRounded(expectedInches) * 10) / INCH_TO_CM;
  return relativeClose(storedInches, exactTen) || relativeClose(storedInches, strippedCmAsInches);
}

function resolveChartRow(audience: string, selectedSize: string): ChartRow | null {
  const fromMemory = findExpressChartRow(audience, selectedSize);
  if (fromMemory) return fromMemory;
  const list = BUNDLED_CHART_ROWS[audience];
  if (!Array.isArray(list)) return null;
  const key = String(selectedSize).trim();
  return list.find((row) => normalizeChartRowSize(row) === key) ?? null;
}

/** Chart/default inch strings for every diagram override that can carry this corruption. */
export function expectedMeasurementOverrideInches(
  context: HistoricalTenTimesRepairContext,
): Record<string, string> | null {
  const audience = context.audience.trim();
  const selectedSize = String(context.selectedSize ?? "").trim();
  if (!audience || !selectedSize) return null;
  const row = context.chartRow ?? resolveChartRow(audience, selectedSize);
  if (!row) return null;
  const fitPreference = context.fitPreference.trim() || "standard";
  const bodyShape = context.bodyShape?.trim() || "straight";
  const dropShoulder = context.dropShoulder === true;
  const defaults = diagramOverrideDefaultsFromChartRow(row, fitPreference, audience, {
    bodyShape,
    dropShoulder,
  });
  if (!dropShoulder) {
    const sleeved = diagramOverrideDefaultsFromChartRow(row, fitPreference, audience, {
      bodyShape,
      dropShoulder: true,
    });
    for (const key of SLEEVE_OVERRIDE_KEYS) {
      const value = sleeved[key];
      if (value && !defaults[key]) defaults[key] = value;
    }
  }
  return defaults;
}

/**
 * Replace overrides that match the historical 10× signature with the chart/default inches.
 * Returns the same object when nothing changes.
 */
export function repairHistoricalTenTimesMeasurementOverrides(
  overrides: Record<string, string>,
  context: HistoricalTenTimesRepairContext,
): Record<string, string> {
  const expected = expectedMeasurementOverrideInches(context);
  if (!expected) return overrides;
  let changed = false;
  const next: Record<string, string> = { ...overrides };
  for (const key of Object.keys(overrides)) {
    const expectedRaw = expected[key];
    if (!expectedRaw) continue;
    const stored = parsePositiveInches(overrides[key]);
    const expectedInches = parsePositiveInches(expectedRaw);
    if (stored === undefined || expectedInches === undefined) continue;
    if (!isHistoricalTenTimesMeasurementOverride(stored, expectedInches)) continue;
    if (next[key] !== expectedRaw) {
      next[key] = expectedRaw;
      changed = true;
    }
  }
  return changed ? next : overrides;
}

export function historicalTenTimesRepairContextFromPattern(pattern: {
  style?: unknown;
  fit?: unknown;
}): HistoricalTenTimesRepairContext | null {
  const style = section(pattern.style);
  const fit = section(pattern.fit);
  const audience =
    normalizeSleevelessAudience(style.recipientCategory) ||
    normalizeSleevelessAudience(fit.sizingChart);
  const selectedSize = String(fit.selectedSize ?? "").trim();
  if (!audience || !selectedSize) return null;
  const fitPreference = String(fit.easeChoice ?? fit.fitChoice ?? "").trim() || "standard";
  const bodyShape = String(style.bodyShape ?? "straight").trim() || "straight";
  return {
    audience,
    selectedSize,
    fitPreference,
    bodyShape,
    dropShoulder: hasAuthoritativeDropShoulderConstruction(style),
  };
}

/** Saved-pattern load helper. Returns the same record when no override needs repair. */
export function repairSavedPatternMeasurementOverrides<T extends { style?: unknown; fit?: unknown }>(
  pattern: T,
): T {
  const context = historicalTenTimesRepairContextFromPattern(pattern);
  if (!context) return pattern;
  const fit = section(pattern.fit);
  const raw = fit.cbMeasurementOverrides;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return pattern;

  const original = raw as Record<string, unknown>;
  const stringMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(original)) {
    if (typeof value === "string" && value.trim()) stringMap[key] = value;
    else if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      stringMap[key] = String(value);
    }
  }

  const repaired = repairHistoricalTenTimesMeasurementOverrides(stringMap, context);
  if (repaired === stringMap) return pattern;

  const nextOverrides: Record<string, unknown> = { ...original };
  for (const [key, value] of Object.entries(repaired)) nextOverrides[key] = value;
  return {
    ...pattern,
    fit: { ...fit, cbMeasurementOverrides: nextOverrides },
  };
}
