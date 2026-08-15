/**
 * Pure helpers for the hat Summary/Edit form.
 * Edits flow through existing hat draft + validation + calculateHatPattern — no second math path.
 */
import type { HatDraft, HatDraftUnit, HatGaugeSlot } from "./hatDraft";
import { createEmptyHatDraft } from "./hatDraft";
import {
  canonicalHatFitStyle,
  isHatNamedFitStyle,
  resolveNamedFitLengthInches,
  resolveTotalHatLengthInches,
  type HatPatternCalc,
} from "./hatMath";
import {
  HAT_BUILDER_ALLOWED_CROWNS,
  HAT_BUILDER_INCOMPLETE_MESSAGE,
  evaluateHatBuilderNeedleCapacity,
  isHatBuilderBrimComplete,
  isHatBuilderCrownComplete,
  isHatBuilderGaugeComplete,
  isHatBuilderInputComplete,
  isHatBuilderLengthComplete,
  isHatBuilderSizeComplete,
  type HatBuilderFieldSnapshot,
  type HatBuilderSizeRow,
} from "./hatBuilderValidation";
import {
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  validateAvailableNeedlesFieldValue,
} from "./hatAvailableNeedles";
import { HAT_EDIT_MEASUREMENT_TARGETS } from "./hatPatternEditTargets";
import { buildHatPatternCalcFromDraft, type HatSizingPatternRow } from "./hatPatternFromDraft";

export { HAT_EDIT_MEASUREMENT_TARGETS };

export type HatEditSizingRow = HatBuilderSizeRow & {
  finishedSizeInches: number;
  /** Chart finished hat length (inches) when the size is from the sizing table. */
  hatLength?: number;
};

export type HatEditFormValues = {
  unit: HatDraftUnit;
  sizeSel: string;
  /** Finished hat circumference in the active unit (custom entry or chart-derived display). */
  finishedCircumference: string;
  fit: string;
  /**
   * Total finished hat length in the active unit (bottom of brim → crown).
   * Same value used by calculateHatPattern / diagram (`resolveTotalHatLengthInches`).
   */
  finishedHatLength: string;
  brimType: string;
  brimLength: string;
  crownShaping: string;
  stitchGauge: string;
  rowGauge: string;
  availableNeedles: string;
};

export type HatEditFieldErrors = Partial<Record<keyof HatEditFormValues | "form", string>>;

function inchesToDisplay(inches: number, unit: HatDraftUnit): string {
  if (!(inches > 0) || !Number.isFinite(inches)) return "";
  if (unit === "cm") {
    return String(Math.round(inches * 2.54 * 10) / 10);
  }
  return inches % 1 === 0 ? String(inches) : String(Math.round(inches * 10) / 10);
}

function displayToInches(raw: string, unit: HatDraftUnit): number | null {
  const n = Number(String(raw).trim());
  if (!(n > 0) || !Number.isFinite(n)) return null;
  return unit === "cm" ? n / 2.54 : n;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.051;
}

/**
 * Display the same total finished length the pattern engine uses
 * (named fit preset when selected, else custom, else chart fallback).
 */
export function resolvedFinishedHatLengthDisplay(
  args: {
    fit: string;
    sizeSel: string;
    customHatLength?: string;
    unit: HatDraftUnit;
  },
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): string {
  const unit: HatDraftUnit = args.unit === "cm" ? "cm" : "inches";
  const inches = resolveTotalHatLengthInches({
    fit: (args.fit ?? "").trim() || "custom",
    hatSizeValue: (args.sizeSel ?? "").trim(),
    customLengthDisplay: Number(args.customHatLength) || 0,
    displayUnit: unit,
    sizingRows,
  });
  if (!(inches != null && inches > 0)) return "";
  return inchesToDisplay(inches, unit);
}

export function hatDraftToEditFormValues(
  draft: HatDraft,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): HatEditFormValues {
  const unit: HatDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const slot: HatGaugeSlot = draft.gaugeSlots[unit] ?? { stitch: "", row: "" };
  const sizeSel = (draft.sizeSel ?? "").trim();
  const fit = canonicalHatFitStyle((draft.fit ?? "").trim());

  let finishedCircumference = "";
  if (sizeSel === "custom") {
    finishedCircumference = (draft.customCircumference ?? "").trim();
  } else if (sizeSel) {
    const row = sizingRows.find((s) => s.size === sizeSel);
    const inches = Number(row?.finishedSizeInches);
    if (inches > 0) finishedCircumference = inchesToDisplay(inches, unit);
  }

  const finishedHatLength = resolvedFinishedHatLengthDisplay(
    {
      fit,
      sizeSel,
      customHatLength: draft.customHatLength,
      unit,
    },
    sizingRows,
  );

  return {
    unit,
    sizeSel,
    finishedCircumference,
    fit,
    finishedHatLength,
    brimType: (draft.brimType ?? "").trim(),
    brimLength: (draft.brimLength ?? "").trim(),
    crownShaping:
      draft.crownShaping === "wedge-4"
        ? "wedge-4-decrease"
        : (draft.crownShaping ?? "").trim(),
    stitchGauge: slot.stitch ?? "",
    rowGauge: slot.row ?? "",
    availableNeedles: draft.availableNeedles ?? "",
  };
}

/**
 * Map edit-form values onto draft size/fit semantics.
 * Changing the circumference away from a chart size becomes custom size.
 * Changing length away from the selected fit preset becomes custom length.
 */
export function resolveHatEditSizeAndLength(
  form: HatEditFormValues,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): Pick<HatDraft, "sizeSel" | "customCircumference" | "fit" | "customHatLength"> {
  const unit: HatDraftUnit = form.unit === "cm" ? "cm" : "inches";
  let sizeSel = form.sizeSel.trim();
  let customCircumference = "";
  const circRaw = form.finishedCircumference.trim();
  const circInches = displayToInches(circRaw, unit);

  if (!sizeSel || sizeSel === "custom") {
    sizeSel = "custom";
    customCircumference = circRaw;
  } else {
    const row = sizingRows.find((s) => s.size === sizeSel);
    const chartInches = Number(row?.finishedSizeInches);
    if (
      circInches != null &&
      Number.isFinite(chartInches) &&
      chartInches > 0 &&
      nearlyEqual(circInches, chartInches)
    ) {
      customCircumference = "";
    } else {
      sizeSel = "custom";
      customCircumference = circRaw;
    }
  }

  let fit = canonicalHatFitStyle(form.fit.trim());
  let customHatLength = "";
  const lengthRaw = form.finishedHatLength.trim();
  const lengthInches = displayToInches(lengthRaw, unit);

  if (!fit || fit === "custom") {
    fit = "custom";
    customHatLength = lengthRaw;
  } else if (isHatNamedFitStyle(fit)) {
    const preset = resolveNamedFitLengthInches(fit, sizeSel, sizingRows);
    const matchesPreset =
      preset != null && lengthInches != null && nearlyEqual(lengthInches, preset);
    // Named fit is kept only when the measurement matches that style’s size-scaled length.
    if (matchesPreset) {
      customHatLength = "";
    } else {
      fit = "custom";
      customHatLength = lengthRaw;
    }
  } else {
    fit = "custom";
    customHatLength = lengthRaw;
  }

  return { sizeSel, customCircumference, fit, customHatLength };
}

export function applyHatEditFormToDraft(
  previous: HatDraft,
  form: HatEditFormValues,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): HatDraft {
  const unit: HatDraftUnit = form.unit === "cm" ? "cm" : "inches";
  const sizeLength = resolveHatEditSizeAndLength(form, sizingRows);
  const gaugeSlots = {
    inches: { ...previous.gaugeSlots.inches },
    cm: { ...previous.gaugeSlots.cm },
  };
  gaugeSlots[unit] = {
    stitch: form.stitchGauge.trim(),
    row: form.rowGauge.trim(),
  };

  return createEmptyHatDraft({
    ...previous,
    unit,
    ...sizeLength,
    brimType: form.brimType.trim(),
    brimLength: form.brimLength.trim(),
    crownShaping: form.crownShaping.trim(),
    gaugeSlots,
    availableNeedles: form.availableNeedles.trim(),
  });
}

export function hatEditDraftToFieldSnapshot(draft: HatDraft): HatBuilderFieldSnapshot {
  const unit: HatDraftUnit = draft.unit === "cm" ? "cm" : "inches";
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

export function validateHatEditForm(
  form: HatEditFormValues,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): { ok: true; draft: ReturnType<typeof applyHatEditFormToDraft> } | { ok: false; errors: HatEditFieldErrors } {
  const previous = createEmptyHatDraft({ unit: form.unit });
  const draft = applyHatEditFormToDraft(previous, form, sizingRows);
  const snapshot = hatEditDraftToFieldSnapshot(draft);
  const errors: HatEditFieldErrors = {};

  if (!isHatBuilderSizeComplete(snapshot, sizingRows)) {
    errors.finishedCircumference = "Enter a finished hat circumference greater than zero.";
  }
  if (!isHatBuilderLengthComplete(snapshot)) {
    errors.finishedHatLength = "Enter a finished hat length greater than zero.";
  }
  if (!isHatBuilderBrimComplete(snapshot)) {
    if (
      snapshot.brimType !== "rolled" &&
      snapshot.brimType !== "single" &&
      snapshot.brimType !== "folded"
    ) {
      errors.brimType = "Choose a brim type.";
    } else {
      errors.brimLength = "Enter a visible brim height greater than zero.";
    }
  }
  if (!isHatBuilderCrownComplete(snapshot)) {
    errors.crownShaping = "Choose a crown style.";
  }
  if (!isHatBuilderGaugeComplete(snapshot)) {
    if (!Number(snapshot.stitchGauge)) errors.stitchGauge = "Enter stitch gauge.";
    if (!Number(snapshot.rowGauge)) errors.rowGauge = "Enter row gauge.";
    const needles = validateAvailableNeedlesFieldValue(snapshot.availableNeedles);
    if (!needles.valid) errors.availableNeedles = AVAILABLE_NEEDLES_REQUIRED_MESSAGE;
  } else {
    const capacity = evaluateHatBuilderNeedleCapacity(snapshot, sizingRows, form.unit);
    if (!capacity.ok) {
      errors.availableNeedles = capacity.message;
    }
  }

  if (Object.keys(errors).length > 0 || !isHatBuilderInputComplete(snapshot, sizingRows)) {
    if (!errors.form) {
      errors.form = errors.availableNeedles?.includes("requires")
        ? errors.availableNeedles
        : HAT_BUILDER_INCOMPLETE_MESSAGE;
    }
    return { ok: false, errors };
  }
  const capacity = evaluateHatBuilderNeedleCapacity(snapshot, sizingRows, form.unit);
  if (!capacity.ok) {
    return {
      ok: false,
      errors: {
        availableNeedles: capacity.message,
        form: capacity.message,
      },
    };
  }
  return { ok: true, draft };
}

/**
 * Live Summary/Edit preview from unsaved form values.
 * Does not read or write `kbm_hat_draft` — callers pass the last saved draft as `previous`
 * only so non-form draft fields (if any) are preserved when applying the form.
 */
export type HatSummaryEditPreviewReady = {
  ok: true;
  draft: HatDraft;
  calc: HatPatternCalc;
  unit: HatDraftUnit;
};

export type HatSummaryEditPreviewInvalid = {
  ok: false;
  errors: HatEditFieldErrors;
};

export function buildHatSummaryEditPreview(
  previous: HatDraft,
  form: HatEditFormValues,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): HatSummaryEditPreviewReady | HatSummaryEditPreviewInvalid {
  const check = validateHatEditForm(form, sizingRows);
  if (!check.ok) return { ok: false, errors: check.errors };

  const draft = applyHatEditFormToDraft(previous, form, sizingRows);
  const calcResult = buildHatPatternCalcFromDraft(
    draft,
    sizingRows as ReadonlyArray<HatSizingPatternRow>,
  );
  if (!calcResult.ok) {
    return { ok: false, errors: { form: calcResult.message } };
  }
  return {
    ok: true,
    draft,
    calc: calcResult.calc,
    unit: calcResult.unit,
  };
}

export function isAllowedHatEditCrown(crown: string): boolean {
  return (HAT_BUILDER_ALLOWED_CROWNS as readonly string[]).includes(crown.trim());
}

/** Convert a positive length display string between inches and cm for edit fields. */
export function convertHatEditLengthDisplay(
  raw: string,
  fromUnit: HatDraftUnit,
  toUnit: HatDraftUnit,
): string {
  if (fromUnit === toUnit) return raw;
  const n = Number(String(raw).trim());
  if (!(n > 0) || !Number.isFinite(n)) return raw;
  const inches = fromUnit === "cm" ? n / 2.54 : n;
  return inchesToDisplay(inches, toUnit);
}

/**
 * Display the size-scaled finished length for a named length style.
 * Uses the same resolver as the builder / pattern calc.
 */
export function fitPresetLengthDisplay(
  fit: string,
  unit: HatDraftUnit,
  sizeSel: string = "",
  sizingRows: ReadonlyArray<HatEditSizingRow> = [],
): string {
  const inches = resolveNamedFitLengthInches(fit, sizeSel, sizingRows);
  if (!(inches != null && inches > 0)) return "";
  return inchesToDisplay(inches, unit);
}

export function chartSizeCircumferenceDisplay(
  sizeSel: string,
  unit: HatDraftUnit,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): string {
  if (!sizeSel || sizeSel === "custom") return "";
  const row = sizingRows.find((s) => s.size === sizeSel);
  const inches = Number(row?.finishedSizeInches);
  if (!(inches > 0)) return "";
  return inchesToDisplay(inches, unit);
}
