/**
 * Shared sleeve cuff / ribbing depth for every sweater with sleeves.
 *
 * Drop Shoulder, Set-In Sleeve, and the Sideways sweater use this label,
 * the same non-negative inch field (0 means no ribbing), and the same
 * zero-depth cast-on or bind-off sentences. Hats, socks, and sleeveless
 * garments are not sleeves and do not use this field.
 */

import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import {
  formatMeasurementDisplayFromInches,
  parseMeasurementInputToInches,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";

export const SLEEVE_CUFF_RIBBING_DEPTH_LABEL = "Sleeve cuff / ribbing depth";
export const SLEEVE_CUFF_RIBBING_DEPTH_LABEL_LINES = ["Sleeve cuff", "ribbing depth"] as const;
export const SLEEVE_CUFF_RIBBING_DEPTH_ERROR = "Enter 0 for no ribbing, or a positive number";
export const SLEEVE_CUFF_RIBBING_DEPTH_OVERRIDE_KEY = "cuffDepth";

export const SLEEVED_SWEATER_CONSTRUCTIONS = [
  "drop-shoulder",
  "set-in-sleeve",
  "sideways-cardigan",
] as const;

export type SleevedSweaterConstruction = (typeof SLEEVED_SWEATER_CONSTRUCTIONS)[number];

export function isSleevedSweaterConstruction(value: unknown): value is SleevedSweaterConstruction {
  return (SLEEVED_SWEATER_CONSTRUCTIONS as readonly string[]).includes(String(value ?? ""));
}

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

/** Sleeved sweaters keep a stored cuff depth, including 0, instead of the audience default. */
export function patternHonorsSleeveCuffDepthOverride(patternData: Record<string, unknown>): boolean {
  const style = section(patternData.style);
  return (
    isSleevedSweaterConstruction(style.construction) ||
    isSleevedSweaterConstruction(style.constructionAuthored)
  );
}

/** No ribbing section when the cuff is zero rows deep. */
export function sleeveCuffRibbingOmitted(cuffRows: number): boolean {
  return !(cuffRows > 0);
}

export function cuffUpNoRibbingCastOnSentence(wristStitches: number): string {
  return `Cast on ${wristStitches} stitches and continue the sleeve.`;
}

export function topDownNoRibbingFinishSentence(): string {
  return "Bind off the live stitches.";
}

/** Shaping-chart action when a top-down sleeve has no cuff to finish. */
export const SLEEVE_NO_RIBBING_CHART_FINISH = "Bind off";

/**
 * Editable cuff depth. Empty is omitted so the audience default can apply.
 * Zero is no ribbing. Positive values follow the page's inches/cm conversion.
 */
export function parseEditableSleeveCuffDepthInches(
  raw: string,
  displayUnit: MeasurementDisplayUnit | null | undefined,
): number | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const n = parseFloat(text.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  if (n === 0) return 0;
  if (displayUnit == null) return Math.round(n * 4) / 4;
  return parseMeasurementInputToInches(text, displayUnit);
}

export function formatEditableSleeveCuffDepthDisplay(
  inches: number | undefined,
  unit: MeasurementDisplayUnit,
): string {
  if (inches === 0) return "0";
  return formatMeasurementDisplayFromInches(inches, unit);
}

/** Canonical stored inches. Zero stays `"0"` so a later read does not restore the default. */
export function formatStoredSleeveCuffDepthInches(inches: number): string {
  if (inches === 0) return "0";
  if (!(inches > 0) || !Number.isFinite(inches)) return "";
  return formatSwatchCountForGaugeInput(Math.round(inches * 4) / 4);
}
