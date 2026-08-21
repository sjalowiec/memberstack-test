/**
 * Soft unusual-gauge warning for pattern builders.
 *
 * Bounds reuse DIY Blanket's "that seems unusual" swatch ranges
 * (10–50 stitches / 10–60 rows over 4"), expressed as stitches-per-inch
 * and rows-per-inch so inches and centimeters stay consistent.
 *
 * This does not change pattern math.
 */

import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import { rawSwatchToPerInch } from "./syncExpressWizardToPatternStorage";

/** DIY Blanket unusual-stitch warning: fewer than 10 stitches over 4". */
export const GAUGE_SANITY_MIN_STITCHES_PER_INCH = 10 / 4;
/** DIY Blanket unusual-stitch warning: more than 50 stitches over 4". */
export const GAUGE_SANITY_MAX_STITCHES_PER_INCH = 50 / 4;
/** DIY Blanket unusual-row warning: fewer than 10 rows over 4". */
export const GAUGE_SANITY_MIN_ROWS_PER_INCH = 10 / 4;
/** DIY Blanket unusual-row warning: more than 60 rows over 4". */
export const GAUGE_SANITY_MAX_ROWS_PER_INCH = 60 / 4;

export const GAUGE_SANITY_WARNING_HEADING = "Please double-check your gauge.";
export const GAUGE_SANITY_CONTINUE_LABEL = "Continue with this gauge";

export type GaugeSanityUnit = "in" | "cm";

export type GaugeSanityReason = "low-stitch" | "high-stitch" | "low-row" | "high-row";

export type GaugeSanityResult = {
  unusual: boolean;
  stitchesPerInch: number;
  rowsPerInch: number;
  stitchRaw: number;
  rowRaw: number;
  unit: GaugeSanityUnit;
  reasons: GaugeSanityReason[];
};

export function toGaugeSanityUnit(unit: string | null | undefined): GaugeSanityUnit {
  const u = String(unit ?? "").trim().toLowerCase();
  return u === "cm" || u === "centimeters" ? "cm" : "in";
}

function parsePositiveGaugeCount(raw: string): number | null {
  const n = parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function collectReasons(spi: number, rpi: number): GaugeSanityReason[] {
  const reasons: GaugeSanityReason[] = [];
  if (spi < GAUGE_SANITY_MIN_STITCHES_PER_INCH) reasons.push("low-stitch");
  if (spi > GAUGE_SANITY_MAX_STITCHES_PER_INCH) reasons.push("high-stitch");
  if (rpi < GAUGE_SANITY_MIN_ROWS_PER_INCH) reasons.push("low-row");
  if (rpi > GAUGE_SANITY_MAX_ROWS_PER_INCH) reasons.push("high-row");
  return reasons;
}

/**
 * Evaluate swatch counts against the DIY Blanket unusual-gauge bounds.
 * Returns null when either count is missing or not a positive number.
 */
export function evaluateGaugeSanity(
  stitchRaw: string,
  rowRaw: string,
  unit: string | null | undefined,
): GaugeSanityResult | null {
  const stitch = parsePositiveGaugeCount(stitchRaw);
  const row = parsePositiveGaugeCount(rowRaw);
  if (stitch == null || row == null) return null;

  const sanityUnit = toGaugeSanityUnit(unit);
  const converted = rawSwatchToPerInch(String(stitch), String(row), sanityUnit);
  const stitchesPerInch = parseFloat(converted.gaugeStitchesPerInch);
  const rowsPerInch = parseFloat(converted.gaugeRowsPerInch);
  if (!(stitchesPerInch > 0) || !(rowsPerInch > 0)) return null;

  const reasons = collectReasons(stitchesPerInch, rowsPerInch);
  return {
    unusual: reasons.length > 0,
    stitchesPerInch,
    rowsPerInch,
    stitchRaw: stitch,
    rowRaw: row,
    unit: sanityUnit,
    reasons,
  };
}

export function gaugeSanityAcknowledgementKey(
  stitchRaw: string,
  rowRaw: string,
  unit: string | null | undefined,
): string {
  return `${String(stitchRaw).trim()}|${String(rowRaw).trim()}|${toGaugeSanityUnit(unit)}`;
}

export function gaugeSanityBlocksProceed(
  result: GaugeSanityResult | null,
  stitchRaw: string,
  rowRaw: string,
  unit: string | null | undefined,
  acknowledgedKey: string | null | undefined,
): result is GaugeSanityResult {
  if (!result?.unusual) return false;
  return acknowledgedKey !== gaugeSanityAcknowledgementKey(stitchRaw, rowRaw, unit);
}

export function formatGaugeSanityWarningBody(result: GaugeSanityResult): string {
  const stitches = formatSwatchCountForGaugeInput(result.stitchRaw);
  const rows = formatSwatchCountForGaugeInput(result.rowRaw);
  if (result.unit === "cm") {
    const stitchesPerCm = formatSwatchCountForGaugeInput(result.stitchRaw / 10);
    const rowsPerCm = formatSwatchCountForGaugeInput(result.rowRaw / 10);
    return `Enter your gauge over 10 cm. You entered ${stitches} stitches and ${rows} rows over 10 cm, which equals approximately ${stitchesPerCm} stitches and ${rowsPerCm} rows per cm.`;
  }
  const spi = formatSwatchCountForGaugeInput(result.stitchesPerInch);
  const rpi = formatSwatchCountForGaugeInput(result.rowsPerInch);
  return `Enter your gauge over 4 inches. You entered ${stitches} stitches and ${rows} rows over 4 inches, which equals approximately ${spi} stitches and ${rpi} rows per inch.`;
}
