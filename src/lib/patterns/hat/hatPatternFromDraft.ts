/**
 * Derive a full hat calc from HatDraft + sizing chart rows.
 */

import type { HatDraft } from "./hatDraft";
import {
  calculateHatPattern,
  resolveTotalHatLengthInches,
  roundFinishedHatSizeFromHead,
  type HatPatternCalc,
  type HatSizingLengthRow,
} from "./hatMath";

export type HatSizingChartRow = HatSizingLengthRow & {
  circumference?: number;
  finishedSizeInches?: number;
};

/** True when the draft has everything needed to generate a pattern. */
export function isHatDraftReadyForPattern(draft: HatDraft | null | undefined): boolean {
  if (!draft || draft.patternType !== "hat") return false;
  if (!draft.sizeSel) return false;
  if (draft.sizeSel === "custom") {
    const circ = parseFloat(draft.customCircumference);
    if (!(circ > 0)) return false;
  }
  if (!draft.fit) return false;
  if (draft.fit === "custom") {
    const len = parseFloat(draft.customHatLength);
    if (!(len > 0)) return false;
  }
  if (draft.brimType !== "single" && draft.brimType !== "folded") return false;
  if (!(parseFloat(draft.brimLength) > 0)) return false;
  if (!["gathered", "wedge-4-decrease", "spiral"].includes(draft.crownShaping)) return false;
  const slot = draft.gaugeSlots[draft.unit === "cm" ? "cm" : "inches"];
  if (!(parseFloat(slot.stitch) > 0) || !(parseFloat(slot.row) > 0)) return false;
  return true;
}

/**
 * Resolve finished circumference (inches) from draft + chart.
 * Standard sizes: chart finishedSizeInches or head×0.9 rounded.
 * Custom: convert display circumference to inches when unit is cm.
 */
export function resolveHatFinishedCircInches(
  draft: HatDraft,
  sizingRows: HatSizingChartRow[],
  convertCmToInches: (cm: number) => number = (cm) => cm / 2.54,
): number | null {
  if (draft.sizeSel === "custom") {
    const circ = parseFloat(draft.customCircumference);
    if (!(circ > 0)) return null;
    return draft.unit === "cm" ? convertCmToInches(circ) : circ;
  }
  const row = sizingRows.find((s) => s.size === draft.sizeSel);
  if (!row) return null;
  if (Number(row.finishedSizeInches) > 0) return Number(row.finishedSizeInches);
  if (Number(row.circumference) > 0) {
    return roundFinishedHatSizeFromHead(Number(row.circumference));
  }
  return null;
}

export function calculateHatPatternFromDraft(
  draft: HatDraft,
  sizingRows: HatSizingChartRow[],
  convertCmToInches: (cm: number) => number = (cm) => cm / 2.54,
): HatPatternCalc | null {
  if (!isHatDraftReadyForPattern(draft)) return null;

  const finishedHatCircInches = resolveHatFinishedCircInches(
    draft,
    sizingRows,
    convertCmToInches,
  );
  if (finishedHatCircInches == null || !(finishedHatCircInches > 0)) return null;

  const totalHatLengthInches = resolveTotalHatLengthInches({
    fit: draft.fit,
    hatSizeValue: draft.sizeSel,
    customLengthDisplay: parseFloat(draft.customHatLength) || 0,
    displayUnit: draft.unit,
    sizingRows,
    convertCmToInches,
  });
  if (totalHatLengthInches == null || !(totalHatLengthInches > 0)) return null;

  const brimRaw = parseFloat(draft.brimLength) || 0;
  const brimDepthInches = draft.unit === "cm" ? convertCmToInches(brimRaw) : brimRaw;

  const selectedSizeRow =
    draft.sizeSel && draft.sizeSel !== "custom"
      ? sizingRows.find((s) => s.size === draft.sizeSel)
      : null;
  const suggestedCrownDepthInches = Number(
    selectedSizeRow?.suggestedCrownDepth ?? selectedSizeRow?.defaultCrownDepth,
  );

  const slot = draft.gaugeSlots[draft.unit === "cm" ? "cm" : "inches"];

  return calculateHatPattern({
    finishedHatCircInches,
    stitchGaugeDisplay: parseFloat(slot.stitch) || 0,
    rowGaugeDisplay: parseFloat(slot.row) || 0,
    displayUnit: draft.unit,
    totalHatLengthInches,
    brimDepthInches,
    brimType: draft.brimType === "folded" ? "folded" : "single",
    crown: draft.crownShaping,
    suggestedCrownDepthInches: Number.isFinite(suggestedCrownDepthInches)
      ? suggestedCrownDepthInches
      : 0,
    fit: draft.fit,
  });
}
