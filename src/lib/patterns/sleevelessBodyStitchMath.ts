/**
 * Shared back-body stitch counts from finished circumference + stitch gauge.
 * One half of finished circumference is cast on the back (or one cardigan half).
 */

import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedHipInches } from "./customBuildEffectiveFinishedHip";

export type SleevelessBodyShapingDirection = "straight" | "decrease" | "increase";

export type SleevelessBodyShapingFromMeasurements = {
  hasBodyShaping: boolean;
  direction: SleevelessBodyShapingDirection;
  effectiveBustInches?: number;
  effectiveHipInches?: number;
};

/** Bust/hip define shaping: hip > bust → decrease; hip < bust → increase; equal → straight. */
export function resolveSleevelessBodyShapingFromMeasurements(
  bustInches: number | undefined,
  hipInches: number | undefined,
): SleevelessBodyShapingFromMeasurements {
  if (
    bustInches === undefined ||
    hipInches === undefined ||
    !(bustInches > 0) ||
    !(hipInches > 0) ||
    hipInches === bustInches
  ) {
    return {
      hasBodyShaping: false,
      direction: "straight",
      effectiveBustInches: bustInches,
      effectiveHipInches: hipInches,
    };
  }
  return {
    hasBodyShaping: true,
    direction: hipInches > bustInches ? "decrease" : "increase",
    effectiveBustInches: bustInches,
    effectiveHipInches: hipInches,
  };
}

/** Resolves body shaping from a pattern's effective finished bust/hip measurements. */
export function resolveSleevelessBodyShapingForPattern(
  patternData: Record<string, unknown>,
): SleevelessBodyShapingFromMeasurements {
  return resolveSleevelessBodyShapingFromMeasurements(
    resolveEffectiveFinishedBustInches(patternData),
    resolveEffectiveFinishedHipInches(patternData),
  );
}

/** Even positive integer stitch count (same rule as cast-on / A-line shaping). */
export function evenPositiveBodyStitches(n: number): number {
  const v = Math.max(0, Math.round(n));
  if (v <= 0) return 0;
  return v % 2 === 0 ? v : v + 1;
}

/**
 * Stitches for half the finished body circumference (back width or one cardigan half).
 * @param finishedCircumferenceInches Finished bust or hip circumference in inches.
 */
export function sleevelessBackHalfStitchesFromCircumference(
  finishedCircumferenceInches: number,
  stitchesPerInch: number,
): number {
  if (!(finishedCircumferenceInches > 0) || !(stitchesPerInch > 0)) return 0;
  const raw = Math.round(finishedCircumferenceInches * stitchesPerInch) / 2;
  return evenPositiveBodyStitches(raw);
}

export type SleevelessBodyStitchDebug = {
  effectiveBustInches?: number;
  effectiveHipInches?: number;
  stitchesPerInch?: number;
  bustBodyStitches: number;
  hipCastOnStitches: number;
  hasBodyShaping: boolean;
  shapingDirection: SleevelessBodyShapingDirection;
};

function stitchesPerInchFromPatternData(patternData: Record<string, unknown>): number | undefined {
  const ygm = patternData.yarnGaugeMachine;
  if (ygm && typeof ygm === "object" && !Array.isArray(ygm)) {
    const v = (ygm as Record<string, unknown>).gaugeStitchesPerInch;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Resolves bust/hip half-body stitch counts from effective measurements and gauge.
 * When hip ≠ bust, cast-on uses hip width; bust width is the armhole target.
 */
export function resolveSleevelessBodyStitchCounts(
  patternData: Record<string, unknown>,
): SleevelessBodyStitchDebug {
  const spi = stitchesPerInchFromPatternData(patternData) ?? 0;
  const shaping = resolveSleevelessBodyShapingForPattern(patternData);
  const effectiveBustInches = shaping.effectiveBustInches;
  const effectiveHipInches = shaping.effectiveHipInches;

  const bustBodyStitches =
    effectiveBustInches !== undefined && spi > 0
      ? sleevelessBackHalfStitchesFromCircumference(effectiveBustInches, spi)
      : 0;

  let hipCastOnStitches = bustBodyStitches;
  if (shaping.hasBodyShaping && effectiveHipInches !== undefined && spi > 0) {
    hipCastOnStitches = sleevelessBackHalfStitchesFromCircumference(effectiveHipInches, spi);
  }

  return {
    effectiveBustInches,
    effectiveHipInches,
    stitchesPerInch: spi > 0 ? spi : undefined,
    bustBodyStitches,
    hipCastOnStitches,
    hasBodyShaping: shaping.hasBodyShaping,
    shapingDirection: shaping.direction,
  };
}

/** Dev/test helper — log or assert the inputs used for cast-on and diagram stitch labels. */
export function formatSleevelessBodyStitchDebug(d: SleevelessBodyStitchDebug): string {
  return JSON.stringify(d);
}
