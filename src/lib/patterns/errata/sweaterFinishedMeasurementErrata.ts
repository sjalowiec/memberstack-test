import { positiveMeasurementInches } from "../customBuildEffectiveArmholeDepth";
import { evenPositiveBodyStitches } from "../sleevelessBodyStitchMath";
import { getDefaultHemLengthInches, roundUpToEvenRows } from "../hemDefaults";
import type {
  ErrataMatchedMeasurement,
  PatternErrataBuilder,
  PatternErrataRecord,
  SavedPatternErrataMatch,
  SweaterFinishedMeasurementMatchRules,
} from "./types";
import { SWEATER_FINISHED_MEASUREMENTS_KIND } from "./types";
import { productionReleaseTiming } from "./productionReleaseCutoff";

export const SWEATER_FINISHED_MEASUREMENTS_ERRATA_ID = "c4e8a1d2-6b47-4f0e-9c31-8a5d2e7b6f10";

export const SWEATER_FINISHED_MEASUREMENTS_ERRATA_SLUG = "sweater-finished-measurements";

/**
 * Production release instant for this correction.
 * Null until the production release. Do not set this for a kin-dev deploy.
 * Patterns created before that release can receive the notice.
 */
export const SWEATER_FINISHED_MEASUREMENTS_PRODUCTION_RELEASED_AT: string | null = null;

/** Record metadata only. This is not the production cutoff. */
const SWEATER_FINISHED_MEASUREMENTS_RECORD_AT = "2026-11-06T12:00:00.000Z";

export const SWEATER_FINISHED_MEASUREMENTS_ERRATA_TITLE = "Saved finished sweater measurements";

export const SWEATER_FINISHED_MEASUREMENTS_WHAT_CHANGED = [
  "Sleeveless, Set-In Sleeve, and Drop Shoulder patterns could show a finished measurement in the editor and then calculate stitches or rows from the size chart, or from the standard hem, instead. Custom Build already used the saved measurement. Instructions and print now use the same saved finished measurement the editor shows.",
  "",
  "The measurements this applies to are garment length, hem depth, armhole depth, shoulder width, neck opening, and front neck depth. Saved measurements are not rewritten.",
  "",
  "A Drop Shoulder armhole is still half the upper arm. Drop Shoulder does not have an editable shoulder width; the cross-shoulder follows the finished bust. Back neck depth is still the size-chart value, and it stays at 1 inch or less. Bust, hip, and cuff depth were already taken from the saved measurement.",
  "",
  "An unedited centimeter measurement that is the same quarter inch as the chart usually keeps the same stitch and row counts. A measurement you changed will change the instructions.",
  "",
  "Affected patterns saved before this correction is released to production can show this notice. Patterns saved after that production release already use the saved finished measurements.",
].join("\n");

export const SWEATER_FINISHED_MEASUREMENTS_KNITTER_ACTION =
  "Garment length, hem depth, armhole depth, shoulder width, neck opening, and front neck depth may change to match the finished measurements already saved on the pattern. A Drop Shoulder armhole still follows the upper arm, and a Drop Shoulder has no separate shoulder width. If you are already knitting, review the instructions before you continue.";

export const SWEATER_FINISHED_MEASUREMENTS_MATCH_RULES: SweaterFinishedMeasurementMatchRules = {
  kind: SWEATER_FINISHED_MEASUREMENTS_KIND,
  correctedAt: SWEATER_FINISHED_MEASUREMENTS_PRODUCTION_RELEASED_AT,
};

export function sweaterFinishedMeasurementErrataRecord(): PatternErrataRecord {
  return {
    id: SWEATER_FINISHED_MEASUREMENTS_ERRATA_ID,
    slug: SWEATER_FINISHED_MEASUREMENTS_ERRATA_SLUG,
    status: "published",
    title: SWEATER_FINISHED_MEASUREMENTS_ERRATA_TITLE,
    whatChanged: SWEATER_FINISHED_MEASUREMENTS_WHAT_CHANGED,
    knitterAction: SWEATER_FINISHED_MEASUREMENTS_KNITTER_ACTION,
    publishedOn: "2026-11-05",
    affectedBuilders: ["drop-shoulder", "sleeveless"],
    affectedSizes: {},
    matchRules: SWEATER_FINISHED_MEASUREMENTS_MATCH_RULES,
    createdAt: SWEATER_FINISHED_MEASUREMENTS_RECORD_AT,
    updatedAt: SWEATER_FINISHED_MEASUREMENTS_RECORD_AT,
    updatedBy: null,
  };
}

type MeasurementKind = "sts" | "rows";

type FinishedField = {
  id: ErrataMatchedMeasurement;
  overrideKey: string;
  kind: MeasurementKind;
  /** Drop Shoulder generation uses this saved field. Armhole and shoulder do not. */
  dropShoulder: boolean;
};

const FINISHED_FIELDS: readonly FinishedField[] = [
  { id: "garment-length", overrideKey: "finishedLength", kind: "rows", dropShoulder: true },
  { id: "hem-depth", overrideKey: "hemDepth", kind: "rows", dropShoulder: true },
  { id: "armhole-depth", overrideKey: "armholeDepth", kind: "rows", dropShoulder: false },
  { id: "shoulder-width", overrideKey: "shoulderWidth", kind: "sts", dropShoulder: false },
  { id: "neck-opening", overrideKey: "finishedNeckOpeningWidth", kind: "sts", dropShoulder: true },
  { id: "front-neck-depth", overrideKey: "neckDepth", kind: "rows", dropShoulder: true },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function quarterInches(value: number): number {
  return Math.round(value * 4) / 4;
}

function createdAtMs(project: Record<string, unknown>, pattern: Record<string, unknown>): number | null {
  for (const record of [project, pattern]) {
    const raw = text(record.createdAt);
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function gauge(pattern: Record<string, unknown>, kind: MeasurementKind): number | undefined {
  const machine = asRecord(pattern.yarnGaugeMachine) ?? {};
  const yarn = asRecord(pattern.yarnGauge) ?? {};
  const raw =
    kind === "sts"
      ? (machine.gaugeStitchesPerInch ?? yarn.stitchGauge)
      : (machine.gaugeRowsPerInch ?? yarn.rowGauge);
  return positiveMeasurementInches(raw);
}

function knittedCount(inches: number, perInch: number, kind: MeasurementKind): number {
  return kind === "sts"
    ? evenPositiveBodyStitches(inches * perInch)
    : roundUpToEvenRows(inches * perInch);
}

function chartNeckOpeningInches(selected: Record<string, unknown>): number | undefined {
  return (
    positiveMeasurementInches(selected.neck_width) ??
    positiveMeasurementInches(selected.neck_opening) ??
    positiveMeasurementInches(selected.neckOpening) ??
    positiveMeasurementInches(selected.neck_opening_width)
  );
}

function previousInches(
  field: FinishedField,
  selected: Record<string, unknown>,
  audience: string,
): number | undefined {
  switch (field.id) {
    case "garment-length":
      return positiveMeasurementInches(selected.back_neck_to_hem);
    case "hem-depth":
      return getDefaultHemLengthInches(audience);
    case "armhole-depth":
      return positiveMeasurementInches(selected.armhole_depth);
    case "shoulder-width":
      return positiveMeasurementInches(selected.shoulder_width);
    case "neck-opening":
      return chartNeckOpeningInches(selected);
    case "front-neck-depth":
      return positiveMeasurementInches(selected.front_neck_depth);
    default:
      return undefined;
  }
}

function blankMatch(
  classification: SavedPatternErrataMatch["classification"],
  reason: string,
  base: Pick<SavedPatternErrataMatch, "builder" | "audience" | "size">,
  matched: ErrataMatchedMeasurement[] = [],
): SavedPatternErrataMatch {
  return {
    classification,
    builder: base.builder,
    audience: base.audience,
    size: base.size,
    lengthInches: null,
    upperArmInches: null,
    matchedMeasurements: matched,
    reason,
  };
}

/**
 * Saved Express measurements whose stitch or row count changes once generation
 * uses the editor value. Custom Build already did that, so it is not affected.
 * Drop Shoulder armhole and shoulder width are not editable finished measurements.
 */
export function classifySweaterFinishedMeasurementErrata(
  pattern: Record<string, unknown>,
  project: Record<string, unknown>,
  rules: SweaterFinishedMeasurementMatchRules,
  base: { builder: PatternErrataBuilder; audience: string | null; size: string },
): SavedPatternErrataMatch {
  const style = asRecord(pattern.style) ?? {};
  if (text(style.patternMode) === "custom-build") {
    return blankMatch(
      "current_default",
      "Custom Build already generates from the saved finished measurements.",
      base,
    );
  }

  const fit = asRecord(pattern.fit) ?? {};
  const selected = asRecord(fit.selectedMeasurements) ?? {};
  const overrides = asRecord(fit.cbMeasurementOverrides) ?? {};
  const audience = base.audience ?? (text(style.recipientCategory) || text(fit.sizingChart));
  const dropShoulder = base.builder === "drop-shoulder";
  const matched: ErrataMatchedMeasurement[] = [];
  let unresolved = false;

  for (const field of FINISHED_FIELDS) {
    if (dropShoulder && !field.dropShoulder) continue;
    const saved = positiveMeasurementInches(overrides[field.overrideKey]);
    if (saved === undefined) continue;
    const previous = previousInches(field, selected, audience);
    if (previous === undefined) {
      matched.push(field.id);
      continue;
    }
    if (quarterInches(saved) === quarterInches(previous)) continue;
    const perInch = gauge(pattern, field.kind);
    if (perInch === undefined) {
      unresolved = true;
      continue;
    }
    if (knittedCount(saved, perInch, field.kind) !== knittedCount(previous, perInch, field.kind)) {
      matched.push(field.id);
    }
  }

  if (matched.length === 0 && unresolved) {
    return blankMatch(
      "uncertain",
      "A saved finished measurement differs from the chart, but the gauge is missing, so the stitch or row change cannot be checked.",
      base,
    );
  }
  if (matched.length === 0) {
    return blankMatch(
      "current_default",
      "The saved finished measurements produce the same stitch and row counts the instructions already used.",
      base,
    );
  }

  const timing = productionReleaseTiming(createdAtMs(project, pattern), rules.correctedAt);
  if (timing === "undated") {
    return blankMatch(
      "uncertain",
      "The saved finished measurements would change the instructions, but the pattern has no creation date, so it is not marked affected.",
      base,
    );
  }
  if (timing === "after-release") {
    return blankMatch(
      "current_default",
      "The pattern was created after this correction was released to production and already generates from the saved finished measurements.",
      base,
    );
  }
  return blankMatch(
    "old_default",
    "A saved finished measurement was not the measurement the instructions used.",
    base,
    matched,
  );
}
