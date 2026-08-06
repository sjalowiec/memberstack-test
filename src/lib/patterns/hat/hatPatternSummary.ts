/**
 * At-a-glance / print summary HTML for the hat pattern workspace.
 */

import type { HatDraft } from "./hatDraft";
import { HAT_FIT_HEIGHTS_INCHES, type HatPatternCalc } from "./hatMath";
import type { HatSizingChartRow } from "./hatPatternFromDraft";

const FIT_LABELS: Record<string, string> = {
  beanie: "Beanie",
  watchcap: "Classic",
  slouchy: "Slouchy",
  relaxed: "Relaxed",
  custom: "Custom",
};

const CROWN_LABELS: Record<string, string> = {
  gathered: "Gathered (cinched top)",
  "wedge-4-decrease": "4-Wedge Decrease",
  "wedge-4": "4-Wedge Decrease",
  spiral: "Spiral Crown (Smooth, Continuous)",
};

const BRIM_LABELS: Record<string, string> = {
  single: "Single Layer",
  folded: "Folded Hem",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHatSizeLabel(
  draft: HatDraft,
  sizingRows: HatSizingChartRow[],
): string {
  if (draft.sizeSel === "custom") {
    const unit = draft.unit === "cm" ? " cm" : '"';
    return `Custom — ${draft.customCircumference}${unit}`;
  }
  const row = sizingRows.find((s) => s.size === draft.sizeSel);
  if (!row) return draft.sizeSel || "—";
  return String((row as { label?: string; extended_label?: string }).extended_label
    || (row as { label?: string }).label
    || draft.sizeSel);
}

export function buildHatLengthLabel(draft: HatDraft, calc: HatPatternCalc): string {
  if (draft.fit === "custom") {
    const unit = draft.unit === "cm" ? " cm" : '"';
    const display =
      draft.unit === "inches"
        ? calc.hatHeight
        : calc.hatHeight * 2.54;
    return `Custom — ${Number(display).toFixed(1)}${unit}`;
  }
  const name = FIT_LABELS[draft.fit] || draft.fit;
  const preset = HAT_FIT_HEIGHTS_INCHES[draft.fit as keyof typeof HAT_FIT_HEIGHTS_INCHES];
  if (preset != null) return `${name} (${preset}" finished hat length)`;
  return name || "—";
}

export function buildHatAtAGlanceHtml(args: {
  draft: HatDraft;
  calc: HatPatternCalc;
  sizingRows: HatSizingChartRow[];
  formatLength: (v: number, unit: string) => string;
  convertLength: (v: number, from: string, to: string) => number;
}): string {
  const { draft, calc, sizingRows, formatLength, convertLength } = args;
  const unit = draft.unit;
  const unitSuffix = unit === "inches" ? '"' : " cm";
  const sizeLabel = buildHatSizeLabel(draft, sizingRows);
  const brimDisp =
    unit === "inches"
      ? formatLength(calc.brimDepth, "inches")
      : formatLength(convertLength(calc.brimDepth, "inches", "cm"), "cm");
  const crownDisp =
    unit === "inches"
      ? formatLength(calc.crownHeightInches, "inches")
      : formatLength(convertLength(calc.crownHeightInches, "inches", "cm"), "cm");
  const lengthLabel = buildHatLengthLabel(draft, calc);
  const crownLabel = CROWN_LABELS[draft.crownShaping] || draft.crownShaping;
  const brimLabel = BRIM_LABELS[draft.brimType] || draft.brimType;
  const gaugeRef = unit === "inches" ? '4"' : "10 cm";
  const slot = draft.gaugeSlots[unit === "cm" ? "cm" : "inches"];

  return `<dl class="hat-at-a-glance">
  <div><dt>Hat size</dt><dd>${escapeHtml(sizeLabel)}</dd></div>
  <div><dt>Finished hat length</dt><dd>${escapeHtml(lengthLabel)}</dd></div>
  <div><dt>Brim</dt><dd>${escapeHtml(brimLabel)} · visible height ${escapeHtml(brimDisp)}${unitSuffix}</dd></div>
  <div><dt>Crown</dt><dd>${escapeHtml(crownLabel)} · depth ${escapeHtml(crownDisp)}${unitSuffix}</dd></div>
  <div><dt>Gauge</dt><dd>${escapeHtml(slot.stitch)} sts / ${escapeHtml(slot.row)} rows per ${gaugeRef}</dd></div>
</dl>`;
}
