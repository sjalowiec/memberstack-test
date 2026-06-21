/**
 * Default hem and cuff lengths (inches) and row counts for pattern math.
 *
 * These defaults are intentionally not user-facing yet; they centralize builder rules
 * so calculators can stay consistent. Hem and cuff row counts are always forced to an
 * even number of rows for machine knitting consistency (pairs of carriage passes).
 *
 * This module does not adjust total garment or sleeve length — only band defaults.
 */

export type PatternAudience = string | null | undefined;

/** Inches: adults and kids (including teens) use the standard band depth. */
const DEFAULT_BAND_INCHES_ADULT_OR_KID = 2;

/** Inches: baby-sized audiences use a shallower band. */
const DEFAULT_BAND_INCHES_BABY = 1;

/**
 * Audiences treated as “baby” segment for default band depth (1″).
 * Matching is case-insensitive; whole-word style via boundaries (covers baby, infant, toddler, etc.).
 */
const BABY_AUDIENCE_PATTERN =
  /\b(baby|babies|infant|infants|toddler|toddlers)\b/i;

function normalizeAudienceToken(audience: PatternAudience): string {
  if (audience == null || typeof audience !== "string") return "";
  return audience.trim().toLowerCase();
}

function isBabyAudience(audience: PatternAudience): boolean {
  const s = normalizeAudienceToken(audience);
  if (!s) return false;
  return BABY_AUDIENCE_PATTERN.test(s);
}

/**
 * Core inches for ribbing / hem / cuff bands before row conversion.
 * Adults, kids, and listed adult sub-audiences → 2″. Baby segment → 1″.
 * Unspecified or unrecognized audience defaults to the adult/kid standard (2″).
 */
function getDefaultBandLengthInches(audience: PatternAudience): number {
  return isBabyAudience(audience) ? DEFAULT_BAND_INCHES_BABY : DEFAULT_BAND_INCHES_ADULT_OR_KID;
}

/** Default finished hem depth in inches for the given audience. */
export function getDefaultHemLengthInches(audience: PatternAudience): number {
  return getDefaultBandLengthInches(audience);
}

/** Default finished cuff depth in inches for the same rules as hems. */
export function getDefaultCuffLengthInches(audience: PatternAudience): number {
  return getDefaultBandLengthInches(audience);
}

/**
 * Round to the nearest whole row, then force even by adding 1 when odd.
 * Odd values are never rounded down to the previous even.
 */
export function roundUpToEvenRows(rows: number): number {
  if (!Number.isFinite(rows)) return 0;
  const rounded = Math.round(rows);
  if (rounded <= 0) return 0;
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function calculateBandRows(
  rowGauge: number,
  audience: PatternAudience,
  inchesForAudience: (a: PatternAudience) => number,
): number {
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) return 0;
  const inches = inchesForAudience(audience);
  return roundUpToEvenRows(inches * rowGauge);
}

/**
 * Default hem rows from gauge (rows per inch) and audience.
 * Returns 0 if rowGauge is missing, non-finite, or ≤ 0.
 */
export function calculateHemRows(rowGauge: number, audience: PatternAudience): number {
  return calculateBandRows(rowGauge, audience, getDefaultHemLengthInches);
}

/**
 * Hem rows from an explicit finished depth in inches (e.g. Custom Build override).
 * Uses the same even-row rounding as {@link calculateHemRows}.
 */
export function calculateHemRowsFromInches(rowGauge: number, hemDepthInches: number): number {
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) return 0;
  if (!Number.isFinite(hemDepthInches) || hemDepthInches <= 0) return 0;
  return roundUpToEvenRows(hemDepthInches * rowGauge);
}

/**
 * Default cuff rows from gauge (rows per inch) and audience.
 * Returns 0 if rowGauge is missing, non-finite, or ≤ 0.
 */
export function calculateCuffRows(rowGauge: number, audience: PatternAudience): number {
  return calculateBandRows(rowGauge, audience, getDefaultCuffLengthInches);
}

/**
 * Cuff rows from an explicit finished depth in inches (e.g. Custom Build override).
 * Uses the same even-row rounding as {@link calculateCuffRows}.
 */
export function calculateCuffRowsFromInches(rowGauge: number, cuffDepthInches: number): number {
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) return 0;
  if (!Number.isFinite(cuffDepthInches) || cuffDepthInches <= 0) return 0;
  return roundUpToEvenRows(cuffDepthInches * rowGauge);
}
