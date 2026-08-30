/**
 * Pure helpers for the dedicated Socks Edit workspace.
 * Edits flow through the existing draft, builder validation, and
 * {@link buildSockSummaryFromDraft} — no second Socks math path.
 */

import type { SockDraft, SockDraftUnit, SockConstructionDirection } from "./sockDraft";
import { createEmptySockDraft } from "./sockDraft";
import {
  SOCK_BUILDER_INCOMPLETE_MESSAGE,
  evaluateSockBuilderNeedleCapacity,
  isSockBuilderConstructionComplete,
  isSockBuilderGaugeFieldsComplete,
  isSockBuilderMeasurementsComplete,
  isSockBuilderSizeComplete,
  snapshotFromSockDraft,
  type SockBuilderFieldSnapshot,
} from "./sockBuilderValidation";
import {
  AVAILABLE_NEEDLES_REQUIRED_MESSAGE,
  isValidExpressAvailableNeedles,
} from "./sockAvailableNeedles";
import {
  applySockSummaryMeasurementsToDraft,
  type SockSummaryMeasureFields,
} from "./sockSummaryEdit";
import {
  buildSockSummaryFromDraft,
  type SockSummaryReady,
} from "./sockPatternFromDraft";
import type { SockSizingAdapter } from "./sockSizing";

export type SockEditFormValues = {
  unit: SockDraftUnit;
  sizeSel: string;
  constructionDirection: string;
  footCircumference: string;
  footLength: string;
  legCircumference: string;
  legLength: string;
  stitchGauge: string;
  rowGauge: string;
  availableNeedles: string;
};

export type SockEditFieldErrors = Partial<Record<keyof SockEditFormValues | "form", string>>;

function positiveNumber(raw: string): boolean {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0;
}

export function sockEditFormMeasureFields(form: SockEditFormValues): SockSummaryMeasureFields {
  return {
    footCircumference: String(form.footCircumference ?? "").trim(),
    footLength: String(form.footLength ?? "").trim(),
    legCircumference: String(form.legCircumference ?? "").trim(),
    legLength: String(form.legLength ?? "").trim(),
  };
}

/** Copy chip/form Perfect Fit values onto the edit form (same draft fields). */
export function withSockEditFormMeasures(
  form: SockEditFormValues,
  measures: SockSummaryMeasureFields,
): SockEditFormValues {
  return {
    ...form,
    footCircumference: String(measures.footCircumference ?? "").trim(),
    footLength: String(measures.footLength ?? "").trim(),
    legCircumference: String(measures.legCircumference ?? "").trim(),
    legLength: String(measures.legLength ?? "").trim(),
  };
}

export function sockDraftToEditFormValues(draft: SockDraft): SockEditFormValues {
  const snap = snapshotFromSockDraft(draft);
  return {
    unit: draft.unit === "cm" ? "cm" : "inches",
    ...snap,
  };
}

function normalizeConstructionDirection(raw: string): SockConstructionDirection | "" {
  const d = raw.trim();
  return d === "cuff-to-toe" || d === "toe-up" ? d : "";
}

export function applySockEditFormToDraft(previous: SockDraft, form: SockEditFormValues): SockDraft {
  const unit: SockDraftUnit = form.unit === "cm" ? "cm" : "inches";
  const withMeasures = applySockSummaryMeasurementsToDraft(
    previous,
    sockEditFormMeasureFields(form),
    unit,
  );
  const gaugeSlots = {
    inches: { ...withMeasures.gaugeSlots.inches },
    cm: { ...withMeasures.gaugeSlots.cm },
  };
  gaugeSlots[unit] = {
    stitch: String(form.stitchGauge ?? "").trim(),
    row: String(form.rowGauge ?? "").trim(),
  };
  return createEmptySockDraft({
    ...withMeasures,
    unit,
    sizeSel: String(form.sizeSel ?? "").trim(),
    constructionDirection: normalizeConstructionDirection(form.constructionDirection),
    gaugeSlots,
    availableNeedles: String(form.availableNeedles ?? "").trim(),
  });
}

function fieldErrorsFromSnapshot(
  fields: SockBuilderFieldSnapshot,
  adapter: SockSizingAdapter,
  unit: SockDraftUnit,
): SockEditFieldErrors {
  const errors: SockEditFieldErrors = {};
  if (!isSockBuilderSizeComplete(fields, adapter)) {
    errors.sizeSel = "Choose a sock size.";
  }
  if (!isSockBuilderConstructionComplete(fields)) {
    errors.constructionDirection = "Choose construction direction.";
  }
  if (!isSockBuilderMeasurementsComplete(fields)) {
    if (!positiveNumber(fields.footCircumference)) {
      errors.footCircumference = "Enter a foot circumference greater than zero.";
    }
    if (!positiveNumber(fields.footLength)) {
      errors.footLength = "Enter a foot length greater than zero.";
    }
    if (!positiveNumber(fields.legCircumference)) {
      errors.legCircumference = "Enter a leg circumference greater than zero.";
    }
    if (!positiveNumber(fields.legLength)) {
      errors.legLength = "Enter a leg length greater than zero.";
    }
  }
  if (!isSockBuilderGaugeFieldsComplete(fields)) {
    if (!positiveNumber(fields.stitchGauge)) errors.stitchGauge = "Enter stitch gauge.";
    if (!positiveNumber(fields.rowGauge)) errors.rowGauge = "Enter row gauge.";
    if (!isValidExpressAvailableNeedles(fields.availableNeedles)) {
      errors.availableNeedles = AVAILABLE_NEEDLES_REQUIRED_MESSAGE;
    }
  } else {
    const capacity = evaluateSockBuilderNeedleCapacity(fields, unit);
    if (!capacity.ok) {
      errors.availableNeedles = capacity.message;
    }
  }
  return errors;
}

export type SockEditValidateOk = {
  ok: true;
  draft: SockDraft;
  preview: SockSummaryReady;
};

export type SockEditValidateFail = {
  ok: false;
  errors: SockEditFieldErrors;
};

/**
 * Validate the Edit form through existing builder checks + Summary-from-draft calc.
 * Does not write storage.
 */
export function validateSockEditForm(
  previous: SockDraft,
  form: SockEditFormValues,
  adapter: SockSizingAdapter,
): SockEditValidateOk | SockEditValidateFail {
  const draft = applySockEditFormToDraft(previous, form);
  const fields = snapshotFromSockDraft(draft);
  const errors = fieldErrorsFromSnapshot(fields, adapter, draft.unit);
  if (Object.keys(errors).length > 0) {
    const first = Object.values(errors).find((msg) => Boolean(msg));
    return {
      ok: false,
      errors: {
        ...errors,
        form: errors.availableNeedles?.includes("require")
          ? errors.availableNeedles
          : first || SOCK_BUILDER_INCOMPLETE_MESSAGE,
      },
    };
  }

  const preview = buildSockSummaryFromDraft(draft, adapter);
  if (!preview.ok) {
    const mapped: SockEditFieldErrors = { form: preview.message };
    if (preview.reason === "needles") mapped.availableNeedles = preview.message;
    if (preview.reason === "calc-error" && /foot length/i.test(preview.message)) {
      mapped.footLength = preview.message;
    }
    return { ok: false, errors: mapped };
  }
  return { ok: true, draft, preview };
}
