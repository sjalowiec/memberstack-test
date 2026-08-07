/**
 * Hat size / fit option labels for the Express-style hat builder (SSR + client refresh).
 * Ported from `src/pages/patterns/hat.astro` Create-tab labeling helpers.
 */

import { roundFinishedHatSizeFromHead } from "./hatMath";

export const HAT_BUILDER_INCH_TO_CM = 2.54;

export type HatSizingLabelRow = {
  size: string;
  label?: string;
  extended_label?: string;
  circumference: number;
  hatLength?: number;
  suggestedCrownDepth?: number;
  finishedSizeInches?: number;
  optionLabel?: string;
};

export const HAT_FIT_PRESET_LABEL_NAMES: Readonly<Record<string, string>> = {
  beanie: "Beanie",
  watchcap: "Classic",
  slouchy: "Slouchy",
  relaxed: "Relaxed",
};

export function formatFinishedInchesForLabel(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 2) / 2;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

/** Head measurement token(s) in inches (e.g. "14", "21–22") → display string for the active unit. */
export function formatHeadInchTokenForDisplay(
  cleanInchPart: string,
  displayUnit: "inches" | "cm",
): string {
  if (displayUnit === "inches") return cleanInchPart;
  const parts = cleanInchPart.split(/[\u2013\-]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return cleanInchPart;
  const nums = parts.map((p) => {
    const n = parseFloat(p);
    if (!Number.isFinite(n)) return p;
    return String(Math.round(n * HAT_BUILDER_INCH_TO_CM));
  });
  return nums.length === 1 ? nums[0] : nums.join("–");
}

export function hatSizeDisplayName(row: HatSizingLabelRow): string {
  const ext = row.extended_label || row.label || row.size;
  const withoutHead = ext.replace(/\s*\([^)]*\bhead\b[^)]*\)\s*$/i, "").trim();
  return withoutHead || row.label || row.size;
}

export function hatFitsClause(
  row: HatSizingLabelRow,
  displayUnit: "inches" | "cm" = "inches",
): string | null {
  const ext = row.extended_label || row.label || "";
  const paren = ext.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    const inner = paren[1].trim();
    if (/\bhead\b/i.test(inner)) {
      let headPart = inner.replace(/\s*head\s*$/i, "").trim();
      headPart = headPart.replace(/^approx\.\s*/i, "").trim();
      const clean = headPart.replace(/["″]/g, "").trim();
      if (displayUnit === "inches") {
        return `fits ~${clean}" head`;
      }
      const display = formatHeadInchTokenForDisplay(clean, displayUnit);
      return `fits ~${display} cm head`;
    }
    if (/\blbs\b|\bmonth\b|\bmonths\b|\byear\b|\byears\b/i.test(inner)) {
      return null;
    }
    return null;
  }
  const head = Number(row.circumference);
  if (Number.isFinite(head) && head > 0) {
    if (displayUnit === "inches") {
      const clean = String(head).replace(/["″]/g, "").trim();
      return `fits ~${clean}" head`;
    }
    const cm = Math.round(head * HAT_BUILDER_INCH_TO_CM);
    return `fits ~${cm} cm head`;
  }
  return null;
}

export function buildHatSizeOptionLabel(
  row: HatSizingLabelRow,
  finishedInches: number,
  displayUnit: "inches" | "cm" = "inches",
): string {
  const name = hatSizeDisplayName(row);
  const finStr =
    displayUnit === "inches"
      ? `${formatFinishedInchesForLabel(finishedInches)}"`
      : `${Math.round(finishedInches * HAT_BUILDER_INCH_TO_CM)} cm`;
  const fits = hatFitsClause(row, displayUnit);
  return fits ? `${name} — ${finStr} finished (${fits})` : `${name} — ${finStr} finished`;
}

export function buildHatSizingBuilderRows(
  rows: ReadonlyArray<HatSizingLabelRow>,
): Array<HatSizingLabelRow & { finishedSizeInches: number; optionLabel: string }> {
  return rows.map((row) => {
    const finishedSizeInches = roundFinishedHatSizeFromHead(Number(row.circumference));
    return {
      ...row,
      finishedSizeInches,
      optionLabel: buildHatSizeOptionLabel(row, finishedSizeInches),
    };
  });
}

export function buildFitPresetOptionLabel(
  fitKey: string,
  inches: number,
  displayUnit: "inches" | "cm",
  convertInchesToCm: (inches: number) => number = (n) => n * HAT_BUILDER_INCH_TO_CM,
): string {
  const name = HAT_FIT_PRESET_LABEL_NAMES[fitKey] || fitKey;
  if (!Number.isFinite(inches)) return `${name} ()`;
  if (displayUnit === "inches") {
    const h = inches % 1 === 0 ? String(inches) : inches.toFixed(1);
    return `${name} (${h}" finished hat length)`;
  }
  const cm = convertInchesToCm(inches);
  return `${name} (${cm.toFixed(1)} cm finished hat length)`;
}
