/**
 * User-facing gauge display for saved Custom Pattern library surfaces (My Patterns list,
 * library drawer, manage rows). Sweaters use `yarnGauge`; Hats use `gaugeSlots` on the
 * saved Hat draft. Does not change how either system stores gauge.
 */

/** Display gauge derived from a saved pattern's `yarnGauge`. */
export type SavedPatternGauge = {
  stitchesPerInch: number;
  rowsPerInch: number;
  /** Original user-entered stitch count (swatch over 4" / 10 cm), when stored. */
  displayStitches?: number;
  /** Original user-entered row count (swatch over 4" / 10 cm), when stored. */
  displayRows?: number;
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
 * Extracts display gauge from a saved pattern's `yarnGauge` section.
 *
 * When raw swatch counts are stored (`gaugeStitchRaw` / `gaugeRowRaw`), those original
 * entered values are kept for display. Per-inch values remain available for internal use.
 * When only per-inch values exist, display uses those directly.
 */
export function extractSavedPatternGauge(yarnGauge: unknown): SavedPatternGauge | null {
  if (!yarnGauge || typeof yarnGauge !== "object" || Array.isArray(yarnGauge)) return null;
  const yg = yarnGauge as Record<string, unknown>;

  const rawSts = toPositiveNumber(yg.gaugeStitchRaw);
  const rawRows = toPositiveNumber(yg.gaugeRowRaw);
  const unit: "in" | "cm" = yg.gaugeRawUnit === "cm" ? "cm" : "in";

  const perInchSts = toPositiveNumber(yg.stitchGauge);
  const perInchRows = toPositiveNumber(yg.rowGauge);

  if (rawSts !== null && rawRows !== null) {
    return {
      stitchesPerInch: perInchSts ?? rawSwatchToPerInch(rawSts, unit),
      rowsPerInch: perInchRows ?? rawSwatchToPerInch(rawRows, unit),
      displayStitches: rawSts,
      displayRows: rawRows,
    };
  }

  if (perInchSts !== null && perInchRows !== null) {
    return { stitchesPerInch: perInchSts, rowsPerInch: perInchRows };
  }

  return null;
}

function record(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function isHatPatternBlob(pattern: unknown): boolean {
  const o = record(pattern);
  return o?.patternType === "hat" || o?.patternSystem === "hat";
}

function readHatGaugeSlot(slots: unknown, unit: "inches" | "cm"): { stitch: number; row: number } | null {
  const root = record(slots);
  const slot = record(root?.[unit]);
  if (!slot) return null;
  const stitch = toPositiveNumber(slot.stitch);
  const row = toPositiveNumber(slot.row);
  if (stitch === null || row === null) return null;
  return { stitch, row };
}

/**
 * Extracts display gauge from a saved Hat draft's `gaugeSlots`.
 * Uses the draft's current unit when that slot is populated; otherwise the other unit.
 * Returns null when the saved Hat has no usable stitch/row values.
 */
export function extractSavedHatGauge(pattern: unknown): SavedPatternGauge | null {
  const direct = record(pattern);
  const nested = record(direct?.hatDraft);
  const draft = isHatPatternBlob(direct) ? direct : isHatPatternBlob(nested) ? nested : direct;
  if (!draft) return null;

  const preferredUnit = draft.unit === "cm" ? "cm" : "inches";
  const fallbackUnit = preferredUnit === "cm" ? "inches" : "cm";
  const preferred = readHatGaugeSlot(draft.gaugeSlots, preferredUnit);
  const used = preferred ?? readHatGaugeSlot(draft.gaugeSlots, fallbackUnit);
  const usedUnit = preferred ? preferredUnit : fallbackUnit;
  if (!used) return null;

  const swatchUnit: "in" | "cm" = usedUnit === "cm" ? "cm" : "in";
  return {
    stitchesPerInch: rawSwatchToPerInch(used.stitch, swatchUnit),
    rowsPerInch: rawSwatchToPerInch(used.row, swatchUnit),
    displayStitches: used.stitch,
    displayRows: used.row,
  };
}

/**
 * Gauge for a saved Custom Pattern project. Hats read `gaugeSlots`; sweaters read `yarnGauge`.
 */
export function extractSavedProjectGauge(project: {
  pattern?: unknown;
  patternSystem?: string | null;
}): SavedPatternGauge | null {
  if (project.patternSystem === "hat" || isHatPatternBlob(project.pattern)) {
    return extractSavedHatGauge(project.pattern);
  }
  const pattern = record(project.pattern);
  return extractSavedPatternGauge(pattern?.yarnGauge);
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
 * User-friendly gauge label, e.g. `"28 sts / 44 rows"` when raw swatch counts were saved,
 * or `"7 sts / 11 rows"` when only per-inch values exist.
 * Returns {@link SAVED_PATTERN_GAUGE_FALLBACK_TEXT} when gauge is missing.
 */
export function formatSavedPatternGauge(gauge: SavedPatternGauge | null | undefined): string {
  if (!gauge) return SAVED_PATTERN_GAUGE_FALLBACK_TEXT;
  const stitches = gauge.displayStitches ?? gauge.stitchesPerInch;
  const rows = gauge.displayRows ?? gauge.rowsPerInch;
  return `${formatGaugeCount(stitches)} sts / ${formatGaugeCount(rows)} rows`;
}
