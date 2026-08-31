/**
 * Basic Socks Builder validation — accordion completeness, capacity, and calc gate.
 * Gauge sanity reuses the Pattern System Lego block via sockValidation.
 */

import {
  isValidExpressAvailableNeedles,
  resolveSockRequiredNeedles,
  validateSockNeedleCapacity,
  type SockNeedleCapacityValidation,
} from "./sockAvailableNeedles";
import { displayMeasurementToInches, formatSockMeasurementDisplay } from "./sockBuilderUnits";
import type { SockConstructionDirection, SockDraft, SockDraftUnit } from "./sockDraft";
import {
  calculateBasicSockPattern,
  type BasicSockCalcInput,
} from "./sockMath";
import {
  findSockChartSize,
  type SockChartMeasurements,
  type SockSizingAdapter,
} from "./sockSizing";
import {
  evaluateSockGaugeSanityGate,
  type SockGaugeSanityGate,
} from "./sockValidation";

export const SOCK_BUILDER_STEPS = 3 as const;

export const SOCK_BUILDER_INCOMPLETE_MESSAGE =
  "Finish the required sections to continue.";

export type SockBuilderFieldSnapshot = {
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

function positiveNumber(raw: string): boolean {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0;
}

export function isSockBuilderSizeComplete(
  fields: Pick<SockBuilderFieldSnapshot, "sizeSel">,
  adapter: SockSizingAdapter,
): boolean {
  return findSockChartSize(adapter, fields.sizeSel) != null;
}

export function isSockBuilderMeasurementsComplete(
  fields: Pick<
    SockBuilderFieldSnapshot,
    "footCircumference" | "footLength" | "legCircumference" | "legLength"
  >,
): boolean {
  return (
    positiveNumber(fields.footCircumference) &&
    positiveNumber(fields.footLength) &&
    positiveNumber(fields.legCircumference) &&
    positiveNumber(fields.legLength)
  );
}

export function isSockBuilderConstructionComplete(
  fields: Pick<SockBuilderFieldSnapshot, "constructionDirection">,
): boolean {
  const d = fields.constructionDirection.trim();
  return d === "cuff-to-toe" || d === "toe-up";
}

export function isSockBuilderGaugeFieldsComplete(
  fields: Pick<SockBuilderFieldSnapshot, "stitchGauge" | "rowGauge" | "availableNeedles">,
): boolean {
  return (
    positiveNumber(fields.stitchGauge) &&
    positiveNumber(fields.rowGauge) &&
    isValidExpressAvailableNeedles(fields.availableNeedles)
  );
}

export function sockChartDefaultsForDisplay(
  row: SockChartMeasurements,
  unit: SockDraftUnit,
): Pick<
  SockBuilderFieldSnapshot,
  "footCircumference" | "footLength" | "legCircumference" | "legLength"
> {
  return {
    footCircumference: formatSockMeasurementDisplay(row.footCircumferenceInches, unit),
    footLength: formatSockMeasurementDisplay(row.footLengthInches, unit),
    legCircumference: formatSockMeasurementDisplay(row.defaultLegCircumferenceInches, unit),
    legLength: formatSockMeasurementDisplay(row.legLengthInches, unit),
  };
}

export function measurementsFromSockSize(
  sizeSel: string,
  adapter: SockSizingAdapter,
  unit: SockDraftUnit,
): ReturnType<typeof sockChartDefaultsForDisplay> | null {
  const row = findSockChartSize(adapter, sizeSel);
  if (!row) return null;
  return sockChartDefaultsForDisplay(row, unit);
}

export function sockBuilderCalcInputFromFields(
  fields: SockBuilderFieldSnapshot,
  unit: SockDraftUnit,
): BasicSockCalcInput | null {
  const footCircumferenceInches = displayMeasurementToInches(fields.footCircumference, unit);
  const footLengthInches = displayMeasurementToInches(fields.footLength, unit);
  const legCircumferenceInches = displayMeasurementToInches(fields.legCircumference, unit);
  const legLengthInches = displayMeasurementToInches(fields.legLength, unit);
  const stitchGaugeDisplay = Number(fields.stitchGauge.trim());
  const rowGaugeDisplay = Number(fields.rowGauge.trim());
  const constructionDirection = fields.constructionDirection.trim() as SockConstructionDirection;
  if (
    footCircumferenceInches == null ||
    footLengthInches == null ||
    legCircumferenceInches == null ||
    legLengthInches == null ||
    !(stitchGaugeDisplay > 0) ||
    !(rowGaugeDisplay > 0) ||
    (constructionDirection !== "cuff-to-toe" && constructionDirection !== "toe-up")
  ) {
    return null;
  }
  return {
    footCircumferenceInches,
    footLengthInches,
    legCircumferenceInches,
    legLengthInches,
    stitchGaugeDisplay,
    rowGaugeDisplay,
    displayUnit: unit,
    constructionDirection,
  };
}

export function resolveSockBuilderRequiredNeedles(
  fields: SockBuilderFieldSnapshot,
  unit: SockDraftUnit,
): number {
  const circ = displayMeasurementToInches(fields.footCircumference, unit);
  const stitchGauge = Number(fields.stitchGauge.trim());
  if (circ == null || !(stitchGauge > 0)) return 0;
  return resolveSockRequiredNeedles({
    footCircumferenceInches: circ,
    stitchGaugeDisplay: stitchGauge,
    displayUnit: unit,
  });
}

export function evaluateSockBuilderNeedleCapacity(
  fields: SockBuilderFieldSnapshot,
  unit: SockDraftUnit,
):
  | SockNeedleCapacityValidation
  | {
      ok: true;
      skipped: true;
      message: string;
      requiredNeedles: number;
      availableNeedles: number;
    } {
  const requiredNeedles = resolveSockBuilderRequiredNeedles(fields, unit);
  if (!(requiredNeedles > 0)) {
    return {
      ok: true,
      skipped: true,
      message: "",
      requiredNeedles: 0,
      availableNeedles: parseInt(fields.availableNeedles, 10) || 0,
    };
  }
  return validateSockNeedleCapacity(fields.availableNeedles, requiredNeedles);
}

export function evaluateSockBuilderCalc(
  fields: SockBuilderFieldSnapshot,
  unit: SockDraftUnit,
): { ok: true } | { ok: false; errors: string[] } {
  const input = sockBuilderCalcInputFromFields(fields, unit);
  if (!input) return { ok: false, errors: [SOCK_BUILDER_INCOMPLETE_MESSAGE] };
  const result = calculateBasicSockPattern(input);
  if (!result.ok) return { ok: false, errors: result.errors };
  return { ok: true };
}

export function evaluateSockBuilderGaugeSanityGate(
  fields: Pick<SockBuilderFieldSnapshot, "stitchGauge" | "rowGauge">,
  unit: SockDraftUnit,
  acknowledgedKey: string | null = null,
): SockGaugeSanityGate {
  return evaluateSockGaugeSanityGate(fields.stitchGauge, fields.rowGauge, unit, acknowledgedKey);
}

export function isSockBuilderGaugeStepReady(
  fields: SockBuilderFieldSnapshot,
  unit: SockDraftUnit,
): boolean {
  if (!isSockBuilderGaugeFieldsComplete(fields)) return false;
  return evaluateSockBuilderNeedleCapacity(fields, unit).ok;
}

export function isSockBuilderInputComplete(
  fields: SockBuilderFieldSnapshot,
  adapter: SockSizingAdapter,
): boolean {
  return (
    isSockBuilderSizeComplete(fields, adapter) &&
    isSockBuilderMeasurementsComplete(fields) &&
    isSockBuilderConstructionComplete(fields) &&
    isSockBuilderGaugeFieldsComplete(fields)
  );
}

/**
 * CTA enablement: required fields + needle capacity.
 * Unusual gauge is a submit-time warning (Hat convention), not an incomplete form.
 * Calc errors (e.g. foot too short) are also shown on submit so an implausible
 * 4 sts / 7 rows gauge can still surface the shared sanity warning first.
 */
export function isSockBuilderCtaEnabled(
  fields: SockBuilderFieldSnapshot,
  adapter: SockSizingAdapter,
  unit: SockDraftUnit,
): boolean {
  return (
    isSockBuilderInputComplete(fields, adapter) &&
    evaluateSockBuilderNeedleCapacity(fields, unit).ok
  );
}

export function isSockBuilderReadyToReview(
  fields: SockBuilderFieldSnapshot,
  adapter: SockSizingAdapter,
  unit: SockDraftUnit,
): boolean {
  return isSockBuilderCtaEnabled(fields, adapter, unit) && evaluateSockBuilderCalc(fields, unit).ok;
}

export function sockBuilderStepComplete(
  step: number,
  fields: SockBuilderFieldSnapshot,
  adapter: SockSizingAdapter,
  unit: SockDraftUnit = "inches",
): boolean {
  switch (step) {
    case 1:
      return isSockBuilderSizeComplete(fields, adapter);
    case 2:
      return isSockBuilderConstructionComplete(fields);
    case 3:
      return isSockBuilderGaugeStepReady(fields, unit);
    default:
      return false;
  }
}

export function sockBuilderChoiceFieldAdvances(field: string): boolean {
  return field.trim() === "constructionDirection";
}

export function nextSockBuilderOpenStepAfterFieldChange(args: {
  advance: boolean;
  openStep: number;
  maxReachableAfter: number;
  prevMaxReachable: number;
  currentStepComplete: boolean;
  totalSteps?: number;
}): number {
  const totalSteps = args.totalSteps ?? SOCK_BUILDER_STEPS;
  const openStep = Math.max(1, Math.min(totalSteps, args.openStep));
  if (!args.advance) return openStep;

  const next = Math.min(totalSteps, openStep + 1);
  if (
    args.currentStepComplete &&
    next <= args.maxReachableAfter &&
    next > openStep
  ) {
    return next;
  }
  if (args.maxReachableAfter > args.prevMaxReachable && args.maxReachableAfter > openStep) {
    return Math.min(openStep + 1, args.maxReachableAfter);
  }
  return openStep;
}

export function snapshotFromSockDraft(draft: SockDraft): SockBuilderFieldSnapshot {
  const unit: SockDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const slot = draft.gaugeSlots[unit] ?? { stitch: "", row: "" };
  return {
    sizeSel: draft.sizeSel ?? "",
    constructionDirection: draft.constructionDirection ?? "",
    footCircumference: draft.footCircumference ?? "",
    footLength: draft.footLength ?? "",
    legCircumference: draft.legCircumference ?? "",
    legLength: draft.legLength ?? "",
    stitchGauge: slot.stitch ?? "",
    rowGauge: slot.row ?? "",
    availableNeedles: draft.availableNeedles ?? "",
  };
}
