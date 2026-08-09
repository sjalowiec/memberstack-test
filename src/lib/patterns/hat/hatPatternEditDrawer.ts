/**
 * Pure helpers for the finished-hat Edit Pattern drawer.
 * Edits flow through existing hat draft + validation + calculateHatPattern — no second math path.
 */
import type { HatDraft, HatDraftUnit, HatGaugeSlot } from "./hatDraft";
import { createEmptyHatDraft } from "./hatDraft";
import { HAT_FIT_HEIGHTS_INCHES } from "./hatMath";
import {
  HAT_BUILDER_ALLOWED_CROWNS,
  HAT_BUILDER_INCOMPLETE_MESSAGE,
  isHatBuilderBrimComplete,
  isHatBuilderCrownComplete,
  isHatBuilderGaugeComplete,
  isHatBuilderInputComplete,
  isHatBuilderLengthComplete,
  isHatBuilderSizeComplete,
  type HatBuilderFieldSnapshot,
  type HatBuilderSizeRow,
} from "./hatBuilderValidation";
import { HAT_EDIT_MEASUREMENT_TARGETS } from "./hatPatternEditTargets";

export { HAT_EDIT_MEASUREMENT_TARGETS };

export type HatEditSizingRow = HatBuilderSizeRow & { finishedSizeInches: number };

export type HatEditFormValues = {
  unit: HatDraftUnit;
  sizeSel: string;
  /** Finished hat circumference in the active unit (custom entry or chart-derived display). */
  finishedCircumference: string;
  fit: string;
  /** Total finished hat length in the active unit (custom entry or preset-derived display). */
  finishedHatLength: string;
  brimType: string;
  brimLength: string;
  crownShaping: string;
  stitchGauge: string;
  rowGauge: string;
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

export function hatDraftToEditFormValues(
  draft: HatDraft,
  sizingRows: ReadonlyArray<HatEditSizingRow>,
): HatEditFormValues {
  const unit: HatDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const slot: HatGaugeSlot = draft.gaugeSlots[unit] ?? { stitch: "", row: "" };
  const sizeSel = (draft.sizeSel ?? "").trim();
  const fit = (draft.fit ?? "").trim();

  let finishedCircumference = "";
  if (sizeSel === "custom") {
    finishedCircumference = (draft.customCircumference ?? "").trim();
  } else if (sizeSel) {
    const row = sizingRows.find((s) => s.size === sizeSel);
    const inches = Number(row?.finishedSizeInches);
    if (inches > 0) finishedCircumference = inchesToDisplay(inches, unit);
  }

  let finishedHatLength = "";
  if (fit === "custom") {
    finishedHatLength = (draft.customHatLength ?? "").trim();
  } else if (fit && Object.prototype.hasOwnProperty.call(HAT_FIT_HEIGHTS_INCHES, fit)) {
    finishedHatLength = inchesToDisplay(
      HAT_FIT_HEIGHTS_INCHES[fit as keyof typeof HAT_FIT_HEIGHTS_INCHES],
      unit,
    );
  }

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
  };
}

/**
 * Map edit-form values onto draft size/fit semantics.
 * Changing the circumference away from a chart size becomes custom size.
 * Changing length away from a fit preset becomes custom length.
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

  let fit = form.fit.trim();
  let customHatLength = "";
  const lengthRaw = form.finishedHatLength.trim();
  const lengthInches = displayToInches(lengthRaw, unit);

  if (!fit || fit === "custom") {
    fit = "custom";
    customHatLength = lengthRaw;
  } else if (Object.prototype.hasOwnProperty.call(HAT_FIT_HEIGHTS_INCHES, fit)) {
    const preset = HAT_FIT_HEIGHTS_INCHES[fit as keyof typeof HAT_FIT_HEIGHTS_INCHES];
    if (lengthInches != null && nearlyEqual(lengthInches, preset)) {
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
    if (snapshot.brimType !== "single" && snapshot.brimType !== "folded") {
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
  }

  if (Object.keys(errors).length > 0 || !isHatBuilderInputComplete(snapshot, sizingRows)) {
    if (!errors.form) errors.form = HAT_BUILDER_INCOMPLETE_MESSAGE;
    return { ok: false, errors };
  }
  return { ok: true, draft };
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

export function fitPresetLengthDisplay(fit: string, unit: HatDraftUnit): string {
  if (!Object.prototype.hasOwnProperty.call(HAT_FIT_HEIGHTS_INCHES, fit)) return "";
  return inchesToDisplay(
    HAT_FIT_HEIGHTS_INCHES[fit as keyof typeof HAT_FIT_HEIGHTS_INCHES],
    unit,
  );
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
