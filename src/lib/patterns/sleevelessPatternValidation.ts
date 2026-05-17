import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import type { SleevelessCustomBuildBodyFinishedMeasurements } from "./sleevelessCustomBuildBodyMeasurements";
import { normalizeSleevelessAudience } from "./patternStorage";

export type SleevelessPatternValidationSeverity = "error" | "warning";

export type SleevelessPatternValidationMessage = {
  id: string;
  severity: SleevelessPatternValidationSeverity;
  field?: string;
  message: string;
};

/** Garment measurement overrides used by the custom-build pattern builder. */
export type SleevelessCustomBuildGarmentMeasurements = Partial<{
  audience: string;
  armholeDepth: number | string;
  finishedLength: number | string;
  hemDepth: number | string;
  neckDepth: number | string;
  shoulderWidth: number | string;
  finishedNeckOpeningWidth: number | string;
  chestBust: number | string;
}>;

export type SleevelessCustomBuildMeasurements = SleevelessCustomBuildGarmentMeasurements &
  SleevelessCustomBuildBodyFinishedMeasurements;

type ArmholeDepthRange = { min: number; max: number };

const ARMHOLE_DEPTH_RANGE_BY_AUDIENCE: Record<string, ArmholeDepthRange> = {
  baby: { min: 2, max: 6 },
  child: { min: 4, max: 10 },
  woman: { min: 6, max: 14 },
  man: { min: 7, max: 16 },
};

/** Conservative “unusual” thresholds — guardrails only, not fit rules. */
const SHOULDER_WIDTH_NARROW_RATIO = 0.12;
const SHOULDER_WIDTH_NARROW_MIN_INCHES = 2.5;
const SHOULDER_WIDTH_WIDE_RATIO = 0.7;
const NECK_OPENING_WIDE_RATIO = 0.85;
const NECK_DEPTH_DEEP_RATIO = 0.75;

function parseInches(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function parseNonNegativeInches(value: unknown): number | undefined {
  const n = parseInches(value);
  if (n === undefined || n < 0) return undefined;
  return n;
}

/** Flat finished bust width (inches), same units as diagram shoulder width. */
function finishedBustWidthInches(input: SleevelessCustomBuildMeasurements): number | undefined {
  return (
    positiveMeasurementInches(input.chestBust) ??
    positiveMeasurementInches(input.finishedBustOrChest)
  );
}

function armholeDepthAudienceKey(audience: unknown): string {
  const normalized = normalizeSleevelessAudience(audience);
  if (normalized === "baby") return "baby";
  if (normalized === "kids") return "child";
  if (normalized === "misses" || normalized === "plus") return "woman";
  if (normalized === "men") return "man";
  return "";
}

function armholeDepthRangeForAudience(audience: unknown): ArmholeDepthRange | undefined {
  const key = armholeDepthAudienceKey(audience);
  if (!key) return undefined;
  return ARMHOLE_DEPTH_RANGE_BY_AUDIENCE[key];
}

function pushError(
  messages: SleevelessPatternValidationMessage[],
  id: string,
  message: string,
  field?: string,
): void {
  messages.push({ id, severity: "error", message, field });
}

function pushWarning(
  messages: SleevelessPatternValidationMessage[],
  id: string,
  message: string,
  field?: string,
): void {
  messages.push({ id, severity: "warning", message, field });
}

function validateStructuralErrors(
  input: SleevelessCustomBuildMeasurements,
  messages: SleevelessPatternValidationMessage[],
): void {
  const neckDepth = positiveMeasurementInches(input.neckDepth);
  const armholeDepth = positiveMeasurementInches(input.armholeDepth);
  const finishedLength = positiveMeasurementInches(input.finishedLength);
  const hemDepth = parseNonNegativeInches(input.hemDepth);
  const shoulderWidth = positiveMeasurementInches(input.shoulderWidth);
  const neckOpeningWidth = positiveMeasurementInches(input.finishedNeckOpeningWidth);
  const finishedBustWidth = finishedBustWidthInches(input);

  if (neckDepth !== undefined && armholeDepth !== undefined && neckDepth > armholeDepth) {
    pushError(
      messages,
      "neck-depth-exceeds-armhole-depth",
      "Neck depth cannot be deeper than the armhole depth.",
      "neckDepth",
    );
  }

  if (
    finishedLength !== undefined &&
    armholeDepth !== undefined &&
    hemDepth !== undefined &&
    finishedLength <= armholeDepth + hemDepth
  ) {
    pushError(
      messages,
      "finished-length-too-short",
      "Finished length must be greater than the armhole depth plus hem depth.",
      "finishedLength",
    );
  }

  if (
    finishedLength !== undefined &&
    armholeDepth !== undefined &&
    hemDepth !== undefined &&
    hemDepth > finishedLength - armholeDepth
  ) {
    pushError(
      messages,
      "hem-depth-too-deep",
      "Hem depth is too large for the selected finished length.",
      "hemDepth",
    );
  }

  if (
    shoulderWidth !== undefined &&
    finishedBustWidth !== undefined &&
    shoulderWidth > finishedBustWidth
  ) {
    pushError(
      messages,
      "shoulder-width-exceeds-bust",
      "Shoulder width cannot be wider than the finished bust width.",
      "shoulderWidth",
    );
  }

  if (
    shoulderWidth !== undefined &&
    neckOpeningWidth !== undefined &&
    shoulderWidth <= neckOpeningWidth
  ) {
    pushError(
      messages,
      "shoulder-width-less-than-neck-opening",
      "Shoulder width must be greater than the neck opening width.",
      "shoulderWidth",
    );
  }

  if (
    neckOpeningWidth !== undefined &&
    shoulderWidth !== undefined &&
    neckOpeningWidth > shoulderWidth
  ) {
    pushError(
      messages,
      "neck-opening-exceeds-shoulder-width",
      "Neck opening width cannot exceed the shoulder width.",
      "finishedNeckOpeningWidth",
    );
  }

  if (armholeDepth !== undefined) {
    const range = armholeDepthRangeForAudience(input.audience);
    if (range && (armholeDepth < range.min || armholeDepth > range.max)) {
      pushError(
        messages,
        "armhole-depth-out-of-range",
        "Armhole depth appears outside the expected range for this audience.",
        "armholeDepth",
      );
    }
  }
}

function validateWarnings(
  input: SleevelessCustomBuildMeasurements,
  messages: SleevelessPatternValidationMessage[],
): void {
  const hemDepth = parseNonNegativeInches(input.hemDepth);
  if (hemDepth === 0) {
    pushWarning(
      messages,
      "hem-depth-zero",
      "Hem depth is 0, so the pattern will not include a hem band.",
      "hemDepth",
    );
  }

  const shoulderWidth = positiveMeasurementInches(input.shoulderWidth);
  const finishedBustWidth = finishedBustWidthInches(input);
  const neckOpeningWidth = positiveMeasurementInches(input.finishedNeckOpeningWidth);
  const neckDepth = positiveMeasurementInches(input.neckDepth);
  const armholeDepth = positiveMeasurementInches(input.armholeDepth);

  if (shoulderWidth !== undefined && finishedBustWidth !== undefined) {
    const narrowLimit = Math.max(
      SHOULDER_WIDTH_NARROW_MIN_INCHES,
      finishedBustWidth * SHOULDER_WIDTH_NARROW_RATIO,
    );
    if (shoulderWidth < narrowLimit) {
      pushWarning(
        messages,
        "shoulder-width-unusually-narrow",
        "Shoulder width is unusually narrow for this finished bust width.",
        "shoulderWidth",
      );
    }

    if (shoulderWidth > finishedBustWidth * SHOULDER_WIDTH_WIDE_RATIO) {
      pushWarning(
        messages,
        "shoulder-width-unusually-wide",
        "Shoulder width is unusually wide for this finished bust width.",
        "shoulderWidth",
      );
    }
  }

  if (
    neckOpeningWidth !== undefined &&
    shoulderWidth !== undefined &&
    neckOpeningWidth > shoulderWidth * NECK_OPENING_WIDE_RATIO
  ) {
    pushWarning(
      messages,
      "neck-opening-unusually-wide",
      "Neck opening width is unusually wide for this shoulder width.",
      "finishedNeckOpeningWidth",
    );
  }

  if (
    neckDepth !== undefined &&
    armholeDepth !== undefined &&
    neckDepth > armholeDepth * NECK_DEPTH_DEEP_RATIO &&
    neckDepth <= armholeDepth
  ) {
    pushWarning(
      messages,
      "neck-depth-unusually-deep",
      "Neck depth is unusually deep relative to the armhole depth.",
      "neckDepth",
    );
  }
}

/**
 * Validates custom-build garment measurements. Never throws; returns every applicable message.
 */
export function validateSleevelessPatternInputs(
  input: SleevelessCustomBuildMeasurements,
): SleevelessPatternValidationMessage[] {
  const messages: SleevelessPatternValidationMessage[] = [];
  validateStructuralErrors(input, messages);
  validateWarnings(input, messages);
  return messages;
}
