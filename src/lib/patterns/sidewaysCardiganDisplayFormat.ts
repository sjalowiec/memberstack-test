/**
 * Knitter-facing number formatting for the Sideways Cardigan builder and workspace.
 * Does not change Drop Shoulder / Sleeveless display helpers.
 */

/** Inches for display: at most two decimal places, no long float tails. */
export function formatInchesForDisplay(inches: number): string {
  if (!Number.isFinite(inches)) return "";
  const rounded = Math.round(inches * 100) / 100;
  if (Math.abs(rounded) < 1e-9) return "0";
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(Number(rounded.toFixed(2)));
}

export function formatInchesWithUnit(inches: number): string {
  const n = formatInchesForDisplay(inches);
  return n ? `${n} in` : "";
}

export function formatStitchesCount(stitches: number): string {
  if (!Number.isFinite(stitches)) return "";
  const n = Math.round(stitches);
  return `${n} ${n === 1 ? "stitch" : "stitches"}`;
}

export function formatRowsCount(rows: number): string {
  if (!Number.isFinite(rows)) return "";
  const n = Math.round(rows);
  return `${n} ${n === 1 ? "row" : "rows"}`;
}

/**
 * Friendly bust-row adjustment. Returns null when there is no adjustment to mention.
 * Example: "1 row smaller (0.17 inches smaller)"
 */
export function formatBustAdjustmentMessage(
  adjustmentRows: number,
  adjustmentInches: number,
): string | null {
  if (!Number.isFinite(adjustmentRows) || adjustmentRows === 0) return null;
  const rows = Math.abs(Math.round(adjustmentRows));
  const dir = adjustmentRows < 0 ? "smaller" : "larger";
  const rowPart = `${rows} ${rows === 1 ? "row" : "rows"} ${dir}`;
  const inchAbs = Math.abs(adjustmentInches);
  if (!Number.isFinite(inchAbs) || inchAbs < 0.005) return rowPart;
  return `${rowPart} (${formatInchesForDisplay(inchAbs)} inches ${dir})`;
}
