/**
 * Hat Express builder validation — ported from `requiredPatternInputsComplete` in hat.astro.
 * Available-needles field/validation reuses shared sweater helpers.
 */

import {
  isValidExpressAvailableNeedles,
  resolveHatRequiredNeedles,
  validateHatNeedleCapacity,
  type HatNeedleCapacityValidation,
} from "./hatAvailableNeedles";
import type { HatDraftUnit } from "./hatDraft";
import { isHatSelectableNamedFitStyle } from "./hatMath";
import {
  evaluateGaugeSanity,
  gaugeSanityAcknowledgementKey,
  gaugeSanityBlocksProceed,
  type GaugeSanityResult,
} from "../gaugeSanity";

export const HAT_BUILDER_ALLOWED_CROWNS = ["gathered", "wedge-4-decrease", "spiral"] as const;
export type HatBuilderAllowedCrown = (typeof HAT_BUILDER_ALLOWED_CROWNS)[number];

export const HAT_BUILDER_INCOMPLETE_MESSAGE =
  "Finish the required sections to generate your pattern.";

export type HatBuilderFieldSnapshot = {
  sizeSel: string;
  customCircumference: string;
  brimType: string;
  brimLength: string;
  crownShaping: string;
  fit: string;
  customHatLength: string;
  stitchGauge: string;
  rowGauge: string;
  /** Shared sweater field name — working needles available on the machine. */
  availableNeedles: string;
};

export type HatBuilderSizeRow = {
  size: string;
  finishedSizeInches: number;
};

function positiveNumber(raw: string): boolean {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0;
}

/** True when size choice alone is complete (accordion step 1). */
export function isHatBuilderSizeComplete(
  fields: Pick<HatBuilderFieldSnapshot, "sizeSel" | "customCircumference">,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): boolean {
  const size = fields.sizeSel.trim();
  if (!size) return false;
  if (size === "custom") {
    return positiveNumber(fields.customCircumference);
  }
  const selected = sizingRows.find((s) => s.size === size);
  return Boolean(selected && Number(selected.finishedSizeInches) > 0);
}

/** True when length/fit choice alone is complete (accordion step 2). */
export function isHatBuilderLengthComplete(
  fields: Pick<HatBuilderFieldSnapshot, "fit" | "customHatLength">,
): boolean {
  const fit = fields.fit.trim();
  if (!fit) return false;
  if (fit === "custom") {
    return positiveNumber(fields.customHatLength);
  }
  // Retired Relaxed remains complete so stored drafts still generate a pattern
  // until they are remapped onto Standard by `canonicalHatFitStyle`.
  return isHatSelectableNamedFitStyle(fit) || fit === "relaxed";
}

/** True when brim type + visible height are complete (accordion step 3). */
export function isHatBuilderBrimComplete(
  fields: Pick<HatBuilderFieldSnapshot, "brimType" | "brimLength">,
): boolean {
  const bt = fields.brimType.trim();
  if (bt !== "rolled" && bt !== "single" && bt !== "folded") return false;
  return positiveNumber(fields.brimLength);
}

/** True when crown choice is one of the release crowns (accordion step 4). */
export function isHatBuilderCrownComplete(
  fields: Pick<HatBuilderFieldSnapshot, "crownShaping">,
): boolean {
  return (HAT_BUILDER_ALLOWED_CROWNS as readonly string[]).includes(
    fields.crownShaping.trim(),
  );
}

/** True when stitch + row gauge and available needles are valid (accordion step 5 fields). */
export function isHatBuilderGaugeComplete(
  fields: Pick<HatBuilderFieldSnapshot, "stitchGauge" | "rowGauge" | "availableNeedles">,
): boolean {
  return (
    positiveNumber(fields.stitchGauge) &&
    positiveNumber(fields.rowGauge) &&
    isValidExpressAvailableNeedles(fields.availableNeedles)
  );
}

export type HatBuilderGaugeSanityGate =
  | { proceed: true }
  | {
      proceed: false;
      reason: "unusual-gauge";
      sanity: GaugeSanityResult;
      acknowledgementKey: string;
    };

/**
 * Soft unusual-gauge gate for Review My Pattern.
 * Does not affect accordion completeness — unusual gauges may still be intentional.
 */
export function evaluateHatBuilderGaugeSanityGate(
  fields: Pick<HatBuilderFieldSnapshot, "stitchGauge" | "rowGauge">,
  unit: HatDraftUnit,
  acknowledgedKey: string | null = null,
): HatBuilderGaugeSanityGate {
  const sanity = evaluateGaugeSanity(fields.stitchGauge, fields.rowGauge, unit);
  const acknowledgementKey = gaugeSanityAcknowledgementKey(
    fields.stitchGauge,
    fields.rowGauge,
    unit,
  );
  if (gaugeSanityBlocksProceed(sanity, fields.stitchGauge, fields.rowGauge, unit, acknowledgedKey)) {
    return { proceed: false, reason: "unusual-gauge", sanity, acknowledgementKey };
  }
  return { proceed: true };
}

/**
 * Finished hat circumference in inches from builder fields, or null when unknown.
 */
export function resolveHatBuilderFinishedCircInches(
  fields: Pick<HatBuilderFieldSnapshot, "sizeSel" | "customCircumference">,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
  unit: HatDraftUnit,
): number | null {
  const size = fields.sizeSel.trim();
  if (!size) return null;
  if (size === "custom") {
    const raw = Number(fields.customCircumference.trim());
    if (!(raw > 0)) return null;
    return unit === "cm" ? raw / 2.54 : raw;
  }
  const selected = sizingRows.find((s) => s.size === size);
  const inches = Number(selected?.finishedSizeInches);
  return inches > 0 ? inches : null;
}

/**
 * Final pattern stitch count for capacity check, or 0 when inputs are incomplete.
 */
export function resolveHatBuilderRequiredNeedles(
  fields: Pick<
    HatBuilderFieldSnapshot,
    "sizeSel" | "customCircumference" | "stitchGauge" | "crownShaping"
  >,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
  unit: HatDraftUnit,
): number {
  const circ = resolveHatBuilderFinishedCircInches(fields, sizingRows, unit);
  const stitchGauge = Number(fields.stitchGauge.trim());
  const crown = fields.crownShaping.trim();
  if (circ == null || !(stitchGauge > 0) || !crown) return 0;
  return resolveHatRequiredNeedles({
    finishedHatCircInches: circ,
    stitchGaugeDisplay: stitchGauge,
    displayUnit: unit,
    crown,
  });
}

/**
 * Live capacity check for Create My Pattern / Edit Pattern.
 * Skipped (ok) until size, stitch gauge, and crown are known enough to compute required stitches.
 */
export function evaluateHatBuilderNeedleCapacity(
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
  unit: HatDraftUnit,
):
  | HatNeedleCapacityValidation
  | {
      ok: true;
      skipped: true;
      message: string;
      requiredNeedles: number;
      availableNeedles: number;
    } {
  const requiredNeedles = resolveHatBuilderRequiredNeedles(fields, sizingRows, unit);
  if (!(requiredNeedles > 0)) {
    return {
      ok: true,
      skipped: true,
      message: "",
      requiredNeedles: 0,
      availableNeedles: parseInt(fields.availableNeedles, 10) || 0,
    };
  }
  return validateHatNeedleCapacity(fields.availableNeedles, requiredNeedles);
}

/** Gauge step complete for accordion: field presence + capacity when computable. */
export function isHatBuilderGaugeStepReady(
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
  unit: HatDraftUnit,
): boolean {
  if (!isHatBuilderGaugeComplete(fields)) return false;
  return evaluateHatBuilderNeedleCapacity(fields, sizingRows, unit).ok;
}

/**
 * All required Create My Pattern *fields* (including a valid available-needles entry).
 * Capacity vs cast-on is checked separately so callers can show the specific needles message.
 */
export function isHatBuilderInputComplete(
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): boolean {
  return (
    isHatBuilderSizeComplete(fields, sizingRows) &&
    isHatBuilderLengthComplete(fields) &&
    isHatBuilderBrimComplete(fields) &&
    isHatBuilderCrownComplete(fields) &&
    isHatBuilderGaugeComplete(fields)
  );
}

/** Fields complete and the hat fits the entered machine needle count. */
export function isHatBuilderReadyToCreatePattern(
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
  unit: HatDraftUnit = "inches",
): boolean {
  return (
    isHatBuilderInputComplete(fields, sizingRows) &&
    evaluateHatBuilderNeedleCapacity(fields, sizingRows, unit).ok
  );
}

/** Accordion step count for the hat express builder. */
export const HAT_BUILDER_STEPS = 5;

/**
 * Whether a picker `[data-choice]` click should auto-advance the accordion.
 * Brim type must stay open so the visible brim height remains editable.
 */
export function hatBuilderChoiceFieldAdvances(field: string): boolean {
  return field.trim() !== "brimType";
}

/**
 * Resolve the open step after a field change.
 * When `advance` is false, the current section stays open even if newly complete
 * (used after brim-type picker selection).
 */
export function nextHatBuilderOpenStepAfterFieldChange(args: {
  advance: boolean;
  openStep: number;
  maxReachableAfter: number;
  prevMaxReachable: number;
  currentStepComplete: boolean;
  totalSteps?: number;
}): number {
  const totalSteps = args.totalSteps ?? HAT_BUILDER_STEPS;
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

/** Per-step completion for accordion lock / checkmarks (steps 1–5). */
export function hatBuilderStepComplete(
  step: number,
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
  unit: HatDraftUnit = "inches",
): boolean {
  switch (step) {
    case 1:
      return isHatBuilderSizeComplete(fields, sizingRows);
    case 2:
      return isHatBuilderLengthComplete(fields);
    case 3:
      return isHatBuilderBrimComplete(fields);
    case 4:
      return isHatBuilderCrownComplete(fields);
    case 5:
      return isHatBuilderGaugeStepReady(fields, sizingRows, unit);
    default:
      return false;
  }
}
