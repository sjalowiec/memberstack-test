/**
 * Swatch gauge → stitches/rows per inch.
 *
 * Knitters enter a count over 4" or over 10 cm. Pattern math always consumes per-inch.
 * When a saved pattern still has the original raw swatch (count + count + unit), that
 * triple is authoritative and replaces any previously stored per-inch value.
 */

export type RawSwatchPerInch = {
  gaugeStitchesPerInch: string;
  gaugeRowsPerInch: string;
};

export function rawSwatchToPerInch(
  stitchRaw: string,
  rowRaw: string,
  unit: "cm" | "in",
): RawSwatchPerInch {
  const s = parseFloat(String(stitchRaw).trim());
  const r = parseFloat(String(rowRaw).trim());
  let gaugeStitchesPerInch = "";
  let gaugeRowsPerInch = "";
  if (unit === "cm") {
    if (Number.isFinite(s) && s > 0) gaugeStitchesPerInch = String((s / 10) * 2.54);
    if (Number.isFinite(r) && r > 0) gaugeRowsPerInch = String((r / 10) * 2.54);
  } else {
    if (Number.isFinite(s) && s > 0) gaugeStitchesPerInch = String(s / 4);
    if (Number.isFinite(r) && r > 0) gaugeRowsPerInch = String(r / 4);
  }
  return { gaugeStitchesPerInch, gaugeRowsPerInch };
}

function isPositiveGaugeCount(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) return false;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return !Number.isNaN(n) && n > 0 && Number.isFinite(n);
}

function firstPositiveRaw(values: unknown[]): unknown {
  for (const value of values) {
    if (isPositiveGaugeCount(value)) return value;
  }
  return undefined;
}

function firstStoredRawUnit(values: unknown[]): "cm" | "in" | undefined {
  for (const value of values) {
    const unit = String(value ?? "").trim();
    if (unit === "cm" || unit === "in") return unit;
  }
  return undefined;
}

/**
 * Per-inch gauge from a complete raw swatch.
 * Returns null when stitch raw, row raw, or unit is missing — callers keep the stored per-inch fallback.
 */
export function authoritativePerInchFromRawSwatch(
  source: Record<string, unknown> | null | undefined,
): RawSwatchPerInch | null {
  if (!source) return null;
  return authoritativePerInchFromRawSwatchSources(source);
}

/**
 * Same rule across canonical `yarnGauge` and builder `yarnGaugeMachine`.
 * The first positive raw count and the first explicit `cm`/`in` unit win.
 */
export function authoritativePerInchFromRawSwatchSources(
  ...sources: Array<Record<string, unknown> | null | undefined>
): RawSwatchPerInch | null {
  const present = sources.filter(
    (source): source is Record<string, unknown> =>
      Boolean(source) && typeof source === "object" && !Array.isArray(source),
  );
  const stitchRaw = firstPositiveRaw(present.map((source) => source.gaugeStitchRaw));
  const rowRaw = firstPositiveRaw(present.map((source) => source.gaugeRowRaw));
  const unit = firstStoredRawUnit(present.map((source) => source.gaugeRawUnit));
  if (!isPositiveGaugeCount(stitchRaw) || !isPositiveGaugeCount(rowRaw) || !unit) return null;

  const derived = rawSwatchToPerInch(String(stitchRaw).trim(), String(rowRaw).trim(), unit);
  if (!derived.gaugeStitchesPerInch || !derived.gaugeRowsPerInch) return null;
  return derived;
}
