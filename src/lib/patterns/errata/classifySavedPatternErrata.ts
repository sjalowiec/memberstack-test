import { positiveMeasurementInches } from "../customBuildEffectiveArmholeDepth";
import {
  DROP_SHOULDER_CONSTRUCTION,
  CONSTRUCTION_AUTHORED_KEY,
  hasAuthoritativeDropShoulderConstruction,
} from "../patternConstructionIdentity";
import { hasAuthoritativeSidewaysCardiganConstruction } from "../sidewaysCardiganConstructionIdentity";
import type {
  ErrataMatchedMeasurement,
  FinishedLengthMatchRules,
  FinishedLengthSizeRule,
  PatternErrataBuilder,
  PatternErrataRecord,
  SavedPatternErrataMatch,
} from "./types";
import { FINISHED_LENGTH_DEFAULTS_KIND, PATTERN_ERRATA_BUILDERS } from "./types";

/** Lengths on the chart are quarter inches. A wider tolerance would hide a real edit. */
const LENGTH_EPSILON_INCHES = 0.02;

const CM_PER_INCH = 2.54;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeSize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function lengthsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= LENGTH_EPSILON_INCHES;
}

function looksLikeCentimeters(stored: number, rule: FinishedLengthSizeRule): boolean {
  const asInches = stored / CM_PER_INCH;
  return (
    lengthsClose(asInches, rule.oldLengthInches) || lengthsClose(asInches, rule.newLengthInches)
  );
}

type BuilderRead =
  | { status: "builder"; builder: PatternErrataBuilder }
  | { status: "other" }
  | { status: "uncertain"; reason: string };

function readBuilder(pattern: Record<string, unknown>, customOverrides: Record<string, unknown>): BuilderRead {
  const patternType = text(pattern.patternType).toLowerCase();
  const patternSystem = text(pattern.patternSystem).toLowerCase();
  if (
    patternType === "hat" ||
    patternSystem === "hat" ||
    patternType === "socks" ||
    patternType === "sock" ||
    patternSystem === "socks"
  ) {
    return { status: "other" };
  }

  const style = asRecord(pattern.style) ?? {};
  if (hasAuthoritativeSidewaysCardiganConstruction(style, customOverrides)) {
    return { status: "other" };
  }
  if (hasAuthoritativeDropShoulderConstruction(style, customOverrides)) {
    return { status: "builder", builder: "drop-shoulder" };
  }

  const construction = text(style.construction);
  if (construction === DROP_SHOULDER_CONSTRUCTION) {
    return {
      status: "uncertain",
      reason:
        "Drop Shoulder construction is stored without the authored marker, so the builder is not certain.",
    };
  }
  if (construction === "sideways-cardigan" && text(style[CONSTRUCTION_AUTHORED_KEY]) !== "sideways-cardigan") {
    return {
      status: "uncertain",
      reason: "Sideways construction is stored without the authored marker, so the builder is not certain.",
    };
  }

  if (patternType === "sleeveless" || patternType === "" || patternSystem === "sleeveless") {
    return { status: "builder", builder: "sleeveless" };
  }

  return {
    status: "uncertain",
    reason: "The saved pattern does not identify a Drop Shoulder or Sleeveless builder.",
  };
}

type AudienceRead =
  | { status: "audience"; audience: string }
  | { status: "uncertain"; reason: string };

function readAudience(pattern: Record<string, unknown>): AudienceRead {
  const style = asRecord(pattern.style) ?? {};
  const fit = asRecord(pattern.fit) ?? {};
  const fromStyle = text(style.recipientCategory).toLowerCase();
  const fromFit = text(fit.sizingChart).toLowerCase();
  if (fromStyle && fromFit && fromStyle !== fromFit) {
    return {
      status: "uncertain",
      reason: "The saved size chart and the recipient category disagree.",
    };
  }
  const audience = fromStyle || fromFit;
  if (!audience) {
    return { status: "uncertain", reason: "The saved pattern does not name a size chart." };
  }
  return { status: "audience", audience };
}

type LengthRead =
  | { status: "inches"; inches: number }
  | { status: "missing" }
  | { status: "conflict" };

/**
 * Finished length the builder would knit, in inches.
 * Custom Build uses `fit.cbMeasurementOverrides.finishedLength` when it is set.
 * Express uses `fit.selectedMeasurements.back_neck_to_hem` and ignores a conflicting override.
 * A conflict between those two fields is left unresolved.
 */
function readFinishedLengthInches(pattern: Record<string, unknown>): LengthRead {
  const style = asRecord(pattern.style) ?? {};
  const fit = asRecord(pattern.fit) ?? {};
  const selected = asRecord(fit.selectedMeasurements) ?? {};
  const overrides = asRecord(fit.cbMeasurementOverrides) ?? {};
  const chart = positiveMeasurementInches(selected.back_neck_to_hem);
  const custom = positiveMeasurementInches(overrides.finishedLength);
  const customBuild = text(style.patternMode) === "custom-build";

  if (customBuild) {
    if (custom !== undefined) return { status: "inches", inches: custom };
    if (chart !== undefined) return { status: "inches", inches: chart };
    return { status: "missing" };
  }

  if (chart !== undefined && custom !== undefined && !lengthsClose(chart, custom)) {
    return { status: "conflict" };
  }
  if (chart !== undefined) return { status: "inches", inches: chart };
  if (custom !== undefined) return { status: "inches", inches: custom };
  return { status: "missing" };
}

function findSizeRule(
  rules: FinishedLengthMatchRules,
  audience: string,
  size: string,
): FinishedLengthSizeRule | null {
  const wanted = normalizeSize(size);
  return (
    rules.sizes.find(
      (rule) => rule.audience === audience && normalizeSize(rule.size) === wanted,
    ) ?? null
  );
}

function parseCreatedAt(project: Record<string, unknown>): number | null {
  const raw = text(project.createdAt);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function ruleHasUpperArm(
  rule: FinishedLengthSizeRule,
): rule is FinishedLengthSizeRule & { oldUpperArmInches: number; newUpperArmInches: number } {
  return (
    typeof rule.oldUpperArmInches === "number" &&
    Number.isFinite(rule.oldUpperArmInches) &&
    typeof rule.newUpperArmInches === "number" &&
    Number.isFinite(rule.newUpperArmInches)
  );
}

type MeasurementRead =
  | { status: "inches"; inches: number }
  | { status: "missing" }
  | { status: "ambiguous" };

/**
 * Upper arm the builder would use, in inches.
 * Drop Shoulder and Custom Build use `cbMeasurementOverrides.upperArm` when it is set.
 * Express Sleeveless uses the chart `upper_arm`. A disagreeing override is ambiguous.
 */
function readUpperArmInches(
  pattern: Record<string, unknown>,
  builder: PatternErrataBuilder,
): MeasurementRead {
  const style = asRecord(pattern.style) ?? {};
  const fit = asRecord(pattern.fit) ?? {};
  const selected = asRecord(fit.selectedMeasurements) ?? {};
  const overrides = asRecord(fit.cbMeasurementOverrides) ?? {};
  const chart = positiveMeasurementInches(selected.upper_arm);
  const custom = positiveMeasurementInches(overrides.upperArm);
  const overrideWins = text(style.patternMode) === "custom-build" || builder === "drop-shoulder";

  if (overrideWins) {
    if (custom !== undefined) return { status: "inches", inches: custom };
    if (chart !== undefined) return { status: "inches", inches: chart };
    return { status: "missing" };
  }
  if (chart !== undefined && custom !== undefined && !lengthsClose(chart, custom)) {
    return { status: "ambiguous" };
  }
  if (chart !== undefined) return { status: "inches", inches: chart };
  if (custom !== undefined) return { status: "inches", inches: custom };
  return { status: "missing" };
}

function lengthReadAsMeasurement(length: LengthRead): MeasurementRead {
  if (length.status === "conflict") return { status: "ambiguous" };
  if (length.status === "missing") return { status: "missing" };
  return { status: "inches", inches: length.inches };
}

type ComparedField = "old" | "current" | "customized" | "uncertain";

function compareStoredInches(
  read: MeasurementRead,
  oldInches: number,
  newInches: number,
  createdAt: number | null,
  correctedAt: number,
): ComparedField {
  if (read.status !== "inches") return "uncertain";
  const inches = read.inches;
  const asInches = inches / CM_PER_INCH;
  const centimeterShaped =
    !lengthsClose(inches, oldInches) &&
    !lengthsClose(inches, newInches) &&
    (lengthsClose(asInches, oldInches) || lengthsClose(asInches, newInches));
  if (centimeterShaped) return "uncertain";
  if (lengthsClose(inches, oldInches)) return "old";
  if (!lengthsClose(inches, newInches)) return "customized";
  if (createdAt === null || createdAt < correctedAt) {
    return createdAt === null ? "uncertain" : "customized";
  }
  return "current";
}

function oldDefaultReason(matched: ErrataMatchedMeasurement[]): string {
  const length = matched.includes("finished-length");
  const arm = matched.includes("upper-arm");
  if (length && arm) {
    return "The saved finished length and upper arm still match the previous defaults.";
  }
  if (arm) return "The saved upper arm still matches the previous default.";
  return "The saved finished length still matches the previous default.";
}

function classifyLengthAndUpperArm(
  pattern: Record<string, unknown>,
  project: Record<string, unknown>,
  rule: FinishedLengthSizeRule & { oldUpperArmInches: number; newUpperArmInches: number },
  correctedAtIso: string,
  base: Pick<SavedPatternErrataMatch, "builder" | "audience" | "size">,
  length: LengthRead,
): SavedPatternErrataMatch {
  const builder = base.builder === "drop-shoulder" ? "drop-shoulder" : "sleeveless";
  const arm = readUpperArmInches(pattern, builder);
  const createdAt = parseCreatedAt(project);
  const correctedAt = Date.parse(correctedAtIso);
  const lengthField = compareStoredInches(
    lengthReadAsMeasurement(length),
    rule.oldLengthInches,
    rule.newLengthInches,
    createdAt,
    correctedAt,
  );
  const armField = compareStoredInches(
    arm,
    rule.oldUpperArmInches,
    rule.newUpperArmInches,
    createdAt,
    correctedAt,
  );
  const matchedMeasurements: ErrataMatchedMeasurement[] = [];
  if (lengthField === "old") matchedMeasurements.push("finished-length");
  if (armField === "old") matchedMeasurements.push("upper-arm");
  const lengthInches = length.status === "inches" ? length.inches : null;
  const upperArmInches = arm.status === "inches" ? arm.inches : null;
  const measured = { ...base, lengthInches, upperArmInches, matchedMeasurements };

  if (matchedMeasurements.length > 0) {
    return match("old_default", oldDefaultReason(matchedMeasurements), measured);
  }
  if (lengthField === "uncertain" || armField === "uncertain") {
    return match(
      "uncertain",
      "A finished length or upper arm is missing or ambiguous, and neither one matches the previous default, so this pattern is not marked affected.",
      { ...measured, matchedMeasurements: [] },
    );
  }
  if (lengthField === "current" && armField === "current") {
    return match(
      "current_default",
      "The pattern was saved after the chart correction and already uses the corrected finished length and upper arm.",
      { ...measured, matchedMeasurements: [] },
    );
  }
  return match(
    "customized",
    "The saved finished length and upper arm are both different from the previous defaults.",
    { ...measured, matchedMeasurements: [] },
  );
}

function match(
  classification: SavedPatternErrataMatch["classification"],
  reason: string,
  extra: Partial<SavedPatternErrataMatch> = {},
): SavedPatternErrataMatch {
  return {
    classification,
    builder: extra.builder ?? null,
    audience: extra.audience ?? null,
    size: extra.size ?? null,
    lengthInches: extra.lengthInches ?? null,
    upperArmInches: extra.upperArmInches ?? null,
    matchedMeasurements: extra.matchedMeasurements ?? [],
    reason,
  };
}

function isFinishedLengthRules(value: unknown): value is FinishedLengthMatchRules {
  const rules = asRecord(value);
  if (!rules || rules.kind !== FINISHED_LENGTH_DEFAULTS_KIND) return false;
  if (typeof rules.correctedAt !== "string" || !Number.isFinite(Date.parse(rules.correctedAt))) {
    return false;
  }
  return Array.isArray(rules.sizes);
}

/**
 * Classify one saved project against one correction.
 * `old_default` is the only class treated as potentially affected.
 * Customized lengths and uncertain reads are never reported as affected.
 */
export function classifySavedPatternForErrata(
  project: unknown,
  errata: Pick<PatternErrataRecord, "affectedBuilders" | "matchRules">,
): SavedPatternErrataMatch {
  const root = asRecord(project);
  const pattern = asRecord(root?.pattern);
  if (!root || !pattern) {
    return match("uncertain", "The saved pattern record could not be read.");
  }

  const customOverrides = asRecord(root.customOverrides) ?? {};
  const builderRead = readBuilder(pattern, customOverrides);
  if (builderRead.status === "other") {
    return match("out_of_scope", "This saved pattern is a different builder.");
  }
  if (builderRead.status === "uncertain") {
    return match("uncertain", builderRead.reason);
  }
  if (!errata.affectedBuilders.includes(builderRead.builder)) {
    return match("out_of_scope", "This builder is not listed on the correction.", {
      builder: builderRead.builder,
    });
  }

  const audienceRead = readAudience(pattern);
  if (audienceRead.status === "uncertain") {
    return match("uncertain", audienceRead.reason, { builder: builderRead.builder });
  }
  if (audienceRead.audience !== "baby" && audienceRead.audience !== "kids") {
    return match("out_of_scope", "This size chart is not part of the correction.", {
      builder: builderRead.builder,
      audience: audienceRead.audience,
    });
  }

  const fit = asRecord(pattern.fit) ?? {};
  const size = text(fit.selectedSize);
  if (!size) {
    return match("uncertain", "The saved pattern does not name a size.", {
      builder: builderRead.builder,
      audience: audienceRead.audience,
    });
  }

  if (!isFinishedLengthRules(errata.matchRules)) {
    return match(
      "uncertain",
      "This correction does not include a finished-length matching rule, so it is not marked affected.",
      { builder: builderRead.builder, audience: audienceRead.audience, size },
    );
  }

  const rule = findSizeRule(errata.matchRules, audienceRead.audience, size);
  if (!rule) {
    return match(
      "uncertain",
      "The size is on a Baby or Kids chart but is not one of the corrected sizes, so it is not marked affected.",
      { builder: builderRead.builder, audience: audienceRead.audience, size },
    );
  }

  const length = readFinishedLengthInches(pattern);
  const base = {
    builder: builderRead.builder,
    audience: audienceRead.audience,
    size: rule.size,
  };
  if (ruleHasUpperArm(rule)) {
    return classifyLengthAndUpperArm(pattern, root, rule, errata.matchRules.correctedAt, base, length);
  }
  if (length.status === "missing") {
    return match("uncertain", "The saved pattern does not include a finished length.", base);
  }
  if (length.status === "conflict") {
    return match(
      "uncertain",
      "The chart finished length and the custom finished length disagree, so neither is treated as the saved length.",
      base,
    );
  }

  if (looksLikeCentimeters(length.inches, rule) && !lengthsClose(length.inches, rule.oldLengthInches) && !lengthsClose(length.inches, rule.newLengthInches)) {
    return match(
      "uncertain",
      "The stored finished length looks like centimeters rather than the inch default, so it is not marked affected.",
      { ...base, lengthInches: length.inches },
    );
  }

  if (lengthsClose(length.inches, rule.oldLengthInches)) {
    return match(
      "old_default",
      "The saved finished length still matches the previous default.",
      { ...base, lengthInches: length.inches, matchedMeasurements: ["finished-length"] },
    );
  }

  if (lengthsClose(length.inches, rule.newLengthInches)) {
    const createdAt = parseCreatedAt(root);
    const correctedAt = Date.parse(errata.matchRules.correctedAt);
    if (createdAt === null) {
      return match(
        "uncertain",
        "The finished length matches the corrected default, but the pattern has no creation date, so it is not marked as a customized length or as affected.",
        { ...base, lengthInches: length.inches },
      );
    }
    if (createdAt >= correctedAt) {
      return match(
        "current_default",
        "The pattern was saved after the chart correction and already uses the corrected finished length.",
        { ...base, lengthInches: length.inches },
      );
    }
    return match(
      "customized",
      "The saved finished length matches the later corrected default, but the pattern was saved before that chart change, so the owner set this length.",
      { ...base, lengthInches: length.inches },
    );
  }

  return match(
    "customized",
    "The saved finished length is different from the previous default.",
    { ...base, lengthInches: length.inches },
  );
}

export function isPatternErrataBuilder(value: string): value is PatternErrataBuilder {
  return (PATTERN_ERRATA_BUILDERS as readonly string[]).includes(value);
}
