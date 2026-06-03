/**
 * User-facing gauge display for saved Custom Pattern library surfaces (My Patterns list,
 * library drawer, manage rows). Derives stitches/rows per inch from the saved pattern's
 * `yarnGauge` section without changing how gauge is stored.
 */

/** Display-only gauge in stitches/rows per inch, derived from a saved pattern's `yarnGauge`. */
export type SavedPatternGauge = {
  stitchesPerInch: number;
  rowsPerInch: number;
};

/** Shown when a saved pattern has no usable gauge yet. */
export const SAVED_PATTERN_GAUGE_FALLBACK_TEXT = "Gauge not set";

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rawSwatchToPerInch(raw: number, unit: "in" | "cm"): number {
  // Raw swatch counts are over 4 inches (in) or 10 cm (cm).
  return unit === "cm" ? (raw / 10) * 2.54 : raw / 4;
}

/**
 * Extracts a display gauge from a saved pattern's `yarnGauge` section.
 *
 * Prefers the stored per-inch values (`stitchGauge` / `rowGauge`); falls back to deriving
 * per-inch from the raw swatch counts (`gaugeStitchRaw` / `gaugeRowRaw` + `gaugeRawUnit`).
 * Returns `null` when no usable gauge is present.
 */
export function extractSavedPatternGauge(yarnGauge: unknown): SavedPatternGauge | null {
  if (!yarnGauge || typeof yarnGauge !== "object" || Array.isArray(yarnGauge)) return null;
  const yg = yarnGauge as Record<string, unknown>;

  const perInchSts = toPositiveNumber(yg.stitchGauge);
  const perInchRows = toPositiveNumber(yg.rowGauge);
  if (perInchSts !== null && perInchRows !== null) {
    return { stitchesPerInch: perInchSts, rowsPerInch: perInchRows };
  }

  const rawSts = toPositiveNumber(yg.gaugeStitchRaw);
  const rawRows = toPositiveNumber(yg.gaugeRowRaw);
  const unit: "in" | "cm" = yg.gaugeRawUnit === "cm" ? "cm" : "in";
  if (rawSts !== null && rawRows !== null) {
    return {
      stitchesPerInch: rawSwatchToPerInch(rawSts, unit),
      rowsPerInch: rawSwatchToPerInch(rawRows, unit),
    };
  }

  return null;
}

/** Formats a single gauge count: whole numbers stay clean, decimals trimmed to ≤2 places. */
function formatGaugeCount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  let s = rounded.toFixed(2);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return s;
}

/**
 * User-friendly gauge label, e.g. `"7 sts / 11 rows"` or `"7.5 sts / 10.25 rows"`.
 * Returns {@link SAVED_PATTERN_GAUGE_FALLBACK_TEXT} when gauge is missing.
 */
export function formatSavedPatternGauge(gauge: SavedPatternGauge | null | undefined): string {
  if (!gauge) return SAVED_PATTERN_GAUGE_FALLBACK_TEXT;
  return `${formatGaugeCount(gauge.stitchesPerInch)} sts / ${formatGaugeCount(gauge.rowsPerInch)} rows`;
}
