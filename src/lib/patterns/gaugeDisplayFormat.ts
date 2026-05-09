/**
 * Swatch-based gauge display (stitches/rows over 4" or 10 cm) for form inputs and summaries.
 * Per-inch values used for pattern math are stored separately; this only shapes what users see in fields.
 */

export type GaugeSwatchBasis = "in" | "cm";

/**
 * Formats a swatch count for gauge inputs: no long float tails, at most 2 decimal places.
 */
export function formatSwatchCountForGaugeInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  let s = rounded.toFixed(2);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return s;
}

/**
 * Legacy: per-inch value → count over 4" (in) or 10 cm (cm) for input display.
 */
export function swatchCountFromPerInchForDisplay(perInch: number, basis: GaugeSwatchBasis): string {
  if (!Number.isFinite(perInch) || perInch <= 0) return "";
  const overBasis = basis === "cm" ? (perInch / 2.54) * 10 : perInch * 4;
  return formatSwatchCountForGaugeInput(overBasis);
}
