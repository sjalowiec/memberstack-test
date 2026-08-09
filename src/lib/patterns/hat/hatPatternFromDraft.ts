/**
 * Convert canonical `kbm_hat_draft` into `calculateHatPattern` input / summary labels.
 * Presentation wiring only — no math changes.
 */

import type { HatDraft, HatDraftUnit } from "./hatDraft";
import {
  isHatBuilderInputComplete,
  type HatBuilderFieldSnapshot,
  type HatBuilderSizeRow,
} from "./hatBuilderValidation";
import {
  validateHatNeedleCapacity,
} from "./hatAvailableNeedles";
import {
  applyHatCrownCastOnAdjustment,
  calculateHatPattern,
  hatBrimDisplayLabel,
  resolveHatBrimType,
  resolveTotalHatLengthInches,
  roundFinishedHatSizeFromHead,
  type HatPatternCalc,
  type HatSizingLengthRow,
} from "./hatMath";
import {
  HAT_FIT_PRESET_LABEL_NAMES,
  buildHatSizeOptionLabel,
  type HatSizingLabelRow,
} from "./hatBuilderSizingLabels";

export const HAT_PATTERN_MISSING_DRAFT_MESSAGE =
  "Create a hat pattern first, then come back to view your instructions.";

export const HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE =
  "Your hat choices are incomplete. Return to the builder to finish size, length, brim, crown, and gauge.";

export const HAT_PATTERN_CALC_ERROR_MESSAGE =
  "We couldn't calculate this hat pattern from your saved choices. Return to the builder and try again.";

export type HatSizingPatternRow = HatSizingLabelRow &
  HatBuilderSizeRow &
  HatSizingLengthRow & {
    finishedSizeInches: number;
    hatLength?: number;
    suggestedCrownDepth?: number;
    defaultCrownDepth?: number;
  };

export type HatPatternCalcReady = {
  ok: true;
  draft: HatDraft;
  calc: HatPatternCalc;
  unit: HatDraftUnit;
  summary: HatPatternSummary;
};

export type HatPatternCalcFailure = {
  ok: false;
  reason: "missing" | "incomplete" | "calc-error" | "needles";
  message: string;
  detail?: string;
};

export type HatPatternCalcResult = HatPatternCalcReady | HatPatternCalcFailure;

export type HatPatternSummary = {
  sizeLabel: string;
  lengthLabel: string;
  brimLabel: string;
  crownLabel: string;
  gaugeLabel: string;
  castOnLabel: string;
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Screen + print-at-a-glance summary list (sweater `print-summary-dl` structure). */
export function buildHatPatternSummaryDlHtml(
  summary: HatPatternSummary,
  opts?: { inline?: boolean },
): string {
  const rows: Array<[string, string]> = [
    ["Size", summary.sizeLabel],
    ["Length", summary.lengthLabel],
    ["Brim", summary.brimLabel],
    ["Crown", summary.crownLabel],
    ["Gauge", summary.gaugeLabel],
    ["Cast on", summary.castOnLabel],
  ];
  const cls = opts?.inline
    ? "print-summary-dl print-summary-dl--inline"
    : "print-summary-dl";
  const pairs = rows
    .map(
      ([term, def]) =>
        `<div class="print-summary-dl__pair"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(def)}</dd></div>`,
    )
    .join("");
  return `<dl class="${cls}">${pairs}</dl>`;
}

function draftToFieldSnapshot(
  draft: HatDraft,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): HatBuilderFieldSnapshot {
  const unit = draft.unit === "cm" ? "cm" : "inches";
  const slot = draft.gaugeSlots[unit] ?? { stitch: "", row: "" };
  return {
    sizeSel: draft.sizeSel ?? "",
    customCircumference: draft.customCircumference ?? "",
    brimType: draft.brimType ?? "",
    brimLength: draft.brimLength ?? "",
    crownShaping:
      draft.crownShaping === "wedge-4" ? "wedge-4-decrease" : draft.crownShaping ?? "",
    fit: draft.fit ?? "",
    customHatLength: draft.customHatLength ?? "",
    stitchGauge: slot.stitch ?? "",
    rowGauge: slot.row ?? "",
    availableNeedles: draft.availableNeedles ?? "",
  };
}

/** True when draft fields are complete enough to run the hat engine. */
export function isHatDraftReadyForPattern(
  draft: HatDraft | null | undefined,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): boolean {
  if (!draft) return false;
  return isHatBuilderInputComplete(draftToFieldSnapshot(draft, sizingRows), sizingRows);
}

function convertCmToInches(cm: number): number {
  return cm / 2.54;
}

function resolveFinishedCircInches(
  draft: HatDraft,
  sizingRows: ReadonlyArray<HatSizingPatternRow>,
): number | null {
  const sizeSel = draft.sizeSel.trim();
  if (!sizeSel) return null;
  if (sizeSel === "custom") {
    const raw = Number(draft.customCircumference);
    if (!(raw > 0)) return null;
    return draft.unit === "cm" ? convertCmToInches(raw) : raw;
  }
  const row = sizingRows.find((s) => s.size === sizeSel);
  if (!row) return null;
  const finished = Number(row.finishedSizeInches);
  if (finished > 0) return finished;
  const fromHead = roundFinishedHatSizeFromHead(Number(row.circumference));
  return fromHead > 0 ? fromHead : null;
}

function crownDisplayLabel(crown: string): string {
  if (crown === "gathered") return "Gathered";
  if (crown === "wedge-4-decrease" || crown === "wedge-4") return "Four-Gore";
  if (crown === "spiral") return "Swirl Top";
  return crown || "—";
}

function brimDisplayLabel(brimType: string): string {
  return hatBrimDisplayLabel(brimType);
}

function lengthDisplayLabel(
  draft: HatDraft,
  unit: HatDraftUnit,
  sizingRows: ReadonlyArray<HatSizingPatternRow>,
): string {
  const fit = draft.fit.trim();
  if (fit === "custom") {
    const raw = draft.customHatLength.trim();
    const unitWord = unit === "cm" ? "cm" : '"';
    return raw ? `Custom · ${raw}${unitWord}` : "Custom";
  }
  const name = HAT_FIT_PRESET_LABEL_NAMES[fit] || fit || "—";
  // Same total finished length as calc/diagram (named fit preset wins over chart hatLength).
  const inches = resolveTotalHatLengthInches({
    fit,
    hatSizeValue: draft.sizeSel,
    customLengthDisplay: Number(draft.customHatLength) || 0,
    displayUnit: unit,
    sizingRows,
  });
  if (!(inches != null && Number.isFinite(inches) && inches > 0)) return name;
  if (unit === "cm") {
    const cm = Math.round(inches * 2.54 * 10) / 10;
    return `${name} · ${cm} cm`;
  }
  const h = inches % 1 === 0 ? String(inches) : inches.toFixed(1);
  return `${name} · ${h}"`;
}

function sizeDisplayLabel(
  draft: HatDraft,
  sizingRows: ReadonlyArray<HatSizingPatternRow>,
  unit: HatDraftUnit,
): string {
  const sizeSel = draft.sizeSel.trim();
  if (sizeSel === "custom") {
    const raw = draft.customCircumference.trim();
    const unitWord = unit === "cm" ? "cm" : '"';
    return raw ? `Custom · ${raw}${unitWord}` : "Custom";
  }
  const row = sizingRows.find((s) => s.size === sizeSel);
  if (!row) return sizeSel || "—";
  return buildHatSizeOptionLabel(row, row.finishedSizeInches, unit);
}

/**
 * Build a full pattern calc from the canonical draft, or a structured failure.
 */
export function buildHatPatternCalcFromDraft(
  draft: HatDraft | null | undefined,
  sizingRows: ReadonlyArray<HatSizingPatternRow>,
): HatPatternCalcResult {
  if (!draft) {
    return {
      ok: false,
      reason: "missing",
      message: HAT_PATTERN_MISSING_DRAFT_MESSAGE,
    };
  }

  if (!isHatDraftReadyForPattern(draft, sizingRows)) {
    return {
      ok: false,
      reason: "incomplete",
      message: HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
    };
  }

  const unit: HatDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const finishedHatCircInches = resolveFinishedCircInches(draft, sizingRows);
  if (!(finishedHatCircInches != null && finishedHatCircInches > 0)) {
    return {
      ok: false,
      reason: "incomplete",
      message: HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
      detail: "finished circumference",
    };
  }

  const totalHatLengthInches = resolveTotalHatLengthInches({
    fit: draft.fit,
    hatSizeValue: draft.sizeSel,
    customLengthDisplay: Number(draft.customHatLength) || 0,
    displayUnit: unit,
    sizingRows,
    convertCmToInches,
  });
  if (!(totalHatLengthInches != null && totalHatLengthInches > 0)) {
    return {
      ok: false,
      reason: "incomplete",
      message: HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
      detail: "finished length",
    };
  }

  const brimRaw = Number(draft.brimLength);
  if (!(brimRaw > 0)) {
    return {
      ok: false,
      reason: "incomplete",
      message: HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
      detail: "brim length",
    };
  }
  const brimDepthInches = unit === "cm" ? convertCmToInches(brimRaw) : brimRaw;

  const slot = draft.gaugeSlots[unit];
  const stitchGaugeDisplay = Number(slot?.stitch);
  const rowGaugeDisplay = Number(slot?.row);
  if (!(stitchGaugeDisplay > 0 && rowGaugeDisplay > 0)) {
    return {
      ok: false,
      reason: "incomplete",
      message: HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
      detail: "gauge",
    };
  }

  const crown =
    draft.crownShaping === "wedge-4" ? "wedge-4-decrease" : draft.crownShaping;
  const brimType = resolveHatBrimType(draft.brimType);

  const selectedSizeRow =
    draft.sizeSel && draft.sizeSel !== "custom"
      ? sizingRows.find((s) => s.size === draft.sizeSel)
      : null;
  const suggestedCrownDepth = Number(
    selectedSizeRow?.suggestedCrownDepth ?? selectedSizeRow?.defaultCrownDepth,
  );

  try {
    const calc = calculateHatPattern({
      finishedHatCircInches,
      stitchGaugeDisplay,
      rowGaugeDisplay,
      displayUnit: unit,
      totalHatLengthInches,
      brimDepthInches,
      brimType,
      crown,
      suggestedCrownDepthInches: Number.isFinite(suggestedCrownDepth)
        ? suggestedCrownDepth
        : 0,
      fit: draft.fit,
    });

    const requiredNeedles = applyHatCrownCastOnAdjustment(calc.castOnSts, crown);
    const needleCheck = validateHatNeedleCapacity(draft.availableNeedles, requiredNeedles);
    if (!needleCheck.ok) {
      return {
        ok: false,
        reason: "needles",
        message: needleCheck.message,
        detail: `required=${needleCheck.requiredNeedles};available=${needleCheck.availableNeedles}`,
      };
    }

    const gaugeRef = unit === "inches" ? '4"' : "10 cm";
    const summary: HatPatternSummary = {
      sizeLabel: sizeDisplayLabel(draft, sizingRows, unit),
      lengthLabel: lengthDisplayLabel(draft, unit, sizingRows),
      brimLabel: `${brimDisplayLabel(brimType)} · ${draft.brimLength.trim()}${
        unit === "cm" ? " cm" : '"'
      }`,
      crownLabel: crownDisplayLabel(crown),
      gaugeLabel: `${stitchGaugeDisplay} sts / ${rowGaugeDisplay} rows per ${gaugeRef}`,
      castOnLabel: `${calc.castOnSts} stitches`,
    };

    return { ok: true, draft, calc, unit, summary };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[hat-pattern] calculateHatPattern failed", err);
    return {
      ok: false,
      reason: "calc-error",
      message: HAT_PATTERN_CALC_ERROR_MESSAGE,
      detail,
    };
  }
}
