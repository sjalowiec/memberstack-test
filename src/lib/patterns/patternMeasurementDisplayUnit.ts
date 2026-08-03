/**
 * Central measurement display-unit handling for the pattern Summary / Edit workspace.
 *
 * Canonical storage: all body measurements are stored in **inches** (decimal strings in
 * `cbMeasurementOverrides`, numbers in `selectedMeasurements`). The unit the user chose while
 * building (the Express / Custom Build `sleeveless-fit` toggle) drives both body-measurement
 * display and the gauge swatch basis, and is persisted on the saved pattern as `gaugeRawUnit`.
 *
 * These helpers convert ONLY at the UI boundary:
 *   - canonical inches ? visible field text for the active display unit (on load)
 *   - visible field text ? canonical inches (on save)
 * Stitch / row / gauge counts are unitless and MUST NOT be passed through these converters.
 *
 * Everything here is shared by every pattern family (Sleeveless, Drop Shoulder, �) so the
 * behavior is fixed once, centrally, rather than per pattern system.
 */
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import { getCurrentPattern, getPatternData } from "./patternStorage";

export type MeasurementDisplayUnit = "in" | "cm";

const INCH_TO_CM = 2.54;

/** Snap a length (in inches) to the quarter-inch grid the pattern math uses. */
export function roundQuarterInches(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Inches ? centimeters, rounded to 0.1 cm (the grid shown in cm fields). */
export function inchesToCmRounded(inches: number): number {
  return Math.round(inches * INCH_TO_CM * 10) / 10;
}

/**
 * A centimeter value the user typed/saw ? canonical inches, preserving the physical width.
 *
 * The cm field shows the 0.1 cm grid, so we snap to that grid (removing float noise from a live
 * field) and convert ONCE. We deliberately do NOT snap the result to the quarter-inch grid: the
 * quarter-inch grid is the inch *input* grid, and forcing cm entries onto it silently shrinks them
 * (e.g. 16 cm ? 6.299 in would collapse to 6.25 in = 15.875 cm). Inches are still canonical; this
 * only decides how faithfully a cm entry is stored. Rounded to 1e-4 in so equal cm entries produce
 * identical strings and repeated save/reopen cycles are idempotent.
 */
export function centimetersToCanonicalInches(cm: number): number {
  const cmOnGrid = Math.round(cm * 10) / 10;
  return Math.round((cmOnGrid / INCH_TO_CM) * 10000) / 10000;
}

/**
 * Serialize canonical inches that were derived from a centimeter entry, WITHOUT snapping to the
 * quarter-inch grid (that snap is a cm-only precision loss). Kept to 4 decimals with trailing zeros
 * trimmed so equal cm entries always serialize to the identical string (idempotent save/reopen).
 */
export function formatCanonicalInchesFromCm(inches: number): string {
  if (!Number.isFinite(inches) || inches <= 0) return "";
  const rounded = Math.round(inches * 10000) / 10000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(rounded).replace(/\.?0+$/, "");
}

/**
 * Canonical stored inches ? visible field text for the active display unit.
 * Returns "" for missing / non-finite values so empty fields stay empty.
 */
export function formatMeasurementDisplayFromInches(
  inches: number | undefined,
  unit: MeasurementDisplayUnit,
): string {
  if (inches === undefined || !Number.isFinite(inches)) return "";
  if (unit === "cm") return String(inchesToCmRounded(inches));
  return formatSwatchCountForGaugeInput(roundQuarterInches(inches));
}

/**
 * Visible field text in the active display unit ? canonical stored inches.
 * Returns `undefined` for empty / non-positive input (same contract as the inch-only parser).
 */
export function parseMeasurementInputToInches(
  raw: string,
  unit: MeasurementDisplayUnit,
): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Inches use the quarter-inch input grid; centimeters preserve the physical width the user typed
  // (converted once, NOT re-snapped to quarter inches — see centimetersToCanonicalInches).
  return unit === "cm" ? centimetersToCanonicalInches(n) : roundQuarterInches(n);
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

/**
 * The measurement display unit a saved pattern was built in, derived from the persisted
 * `gaugeRawUnit`. Mirrors the "any source says cm" rule already used by the pattern diagram and
 * the gauge inputs. Projects saved before the unit was persisted (no `gaugeRawUnit` anywhere)
 * default to inches � the legacy behavior � so older projects are unchanged.
 *
 * Pure: pass canonical (`kbm_current_pattern`) and `patternBuilderData` objects. Read-only.
 */
export function resolveMeasurementDisplayUnitFromPatternData(
  canonical: unknown,
  patternBuilderData: unknown,
): MeasurementDisplayUnit {
  const canon = section(canonical);
  const pb = section(patternBuilderData);
  const candidates = [
    section(pb.yarnGaugeMachine).gaugeRawUnit,
    section(canon.yarnGaugeMachine).gaugeRawUnit,
    section(canon.yarnGauge).gaugeRawUnit,
    section(pb.yarnGauge).gaugeRawUnit,
  ];
  return candidates.some((c) => String(c ?? "").trim() === "cm") ? "cm" : "in";
}

/**
 * Storage-backed resolver used by the Edit workspace / measurement editor: reads the saved
 * working draft and returns the unit the pattern was built in (inches for legacy projects).
 */
export function resolveSavedPatternMeasurementDisplayUnit(): MeasurementDisplayUnit {
  return resolveMeasurementDisplayUnitFromPatternData(getCurrentPattern(), getPatternData());
}
