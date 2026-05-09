/**
 * Display-only helpers for body measurements on sizing charts and pattern builders.
 * Matches /reference/sizing-charts inline conversion: whole cm via Math.round(inches * 2.54).
 */

/** Garment body measurements: inches ↔ cm use ×2.54 only (not mm/in ×10). */
export const INCH_TO_CM = 2.54;

/** Optional JSON keys for precomputed cm body bust/chest (future-proof if data adds them). */
const BODY_BUST_CM_KEYS = ["bust_or_chest_cm", "body_bust_cm", "chest_cm"] as const;

/** Same formula as sizing-charts.astro `toCm`. */
export function bodyMeasurementInchesToCmRounded(inches: number): number {
  return Math.round(inches * INCH_TO_CM);
}

export function pickBodyBustChestCmFromRow(row: Record<string, unknown>): number | null {
  for (const k of BODY_BUST_CM_KEYS) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return Math.round(n);
    }
  }
  return null;
}

/**
 * Inch display for size dropdowns: whole numbers without decimals; half-inches as n.5 only.
 */
export function formatBodyMeasurementInchesForLabel(inches: number): string {
  if (!Number.isFinite(inches)) return "";
  const halfStep = Math.round(inches * 2) / 2;
  return halfStep % 1 === 0 ? String(Math.round(halfStep)) : halfStep.toFixed(1);
}

/** Fine-tune finished measurements: cm shown to one decimal from stored inches. */
export function garmentFinishedInchesToCmDisplay(inches: number): number {
  if (!Number.isFinite(inches)) return NaN;
  return Math.round(inches * INCH_TO_CM * 10) / 10;
}

/** Fine-tune field: typed cm → underlying inches (caller rounds to quarter-inch). */
export function garmentCmTypedToInches(cm: number): number {
  if (!Number.isFinite(cm)) return NaN;
  return cm / INCH_TO_CM;
}
