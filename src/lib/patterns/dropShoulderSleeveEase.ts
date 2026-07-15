/**
 * Drop Shoulder — fit-based sleeve circumference ease (single source of truth).
 *
 * Circumference ease added to sizing-chart body measurements to produce finished
 * sleeve upper-arm and wrist defaults. This is separate from body bust ease and
 * from per-side stitch shaping amounts.
 */

export type SleeveEaseGroup = "baby" | "child" | "adult";
export type FitLevel = "close" | "standard" | "relaxed";

export type SleeveEase = {
  upperArmInches: number;
  wristInches: number;
};

const SLEEVE_EASE_BY_GROUP: Record<SleeveEaseGroup, Record<FitLevel, SleeveEase>> = {
  adult: {
    close: { upperArmInches: 1.0, wristInches: 0.5 },
    standard: { upperArmInches: 2.0, wristInches: 0.75 },
    relaxed: { upperArmInches: 3.0, wristInches: 1.0 },
  },
  baby: {
    close: { upperArmInches: 0.5, wristInches: 0.25 },
    standard: { upperArmInches: 0.75, wristInches: 0.375 },
    relaxed: { upperArmInches: 1.0, wristInches: 0.5 },
  },
  child: {
    close: { upperArmInches: 0.75, wristInches: 0.375 },
    standard: { upperArmInches: 1.25, wristInches: 0.5 },
    relaxed: { upperArmInches: 1.75, wristInches: 0.75 },
  },
};

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Normalize a fit identifier to a sleeve-ease fit level. Persisted `relaxed` (and user-facing
 * `oversized`) map to Relaxed ease. Anything else falls back to Standard.
 */
export function normalizeSleeveEaseFit(fit: unknown): FitLevel {
  const raw = String(fit ?? "").trim().toLowerCase();
  if (raw === "close") return "close";
  if (raw === "oversized" || raw === "relaxed") return "relaxed";
  return "standard";
}

/**
 * Map a repo sizing audience / chart identity to a sleeve-ease size group. Returns `undefined`
 * for unrecognized audiences so callers can fall back to raw body measurements.
 *
 * Baby ? baby, Kids ? child, Misses / Plus / Men ? adult.
 */
export function dropShoulderSleeveEaseGroupForChartAudience(
  chartAudience: unknown,
): SleeveEaseGroup | undefined {
  const raw = String(chartAudience ?? "").trim().toLowerCase();
  switch (raw) {
    case "baby":
      return "baby";
    case "kids":
    case "kid":
      return "child";
    case "misses":
    case "plus":
    case "women":
    case "woman":
    case "men":
    case "man":
      return "adult";
    default:
      return undefined;
  }
}

/** Circumference ease defaults for a size group and fit level. */
export function getDefaultSleeveEase(args: {
  sizeGroup: SleeveEaseGroup;
  fit: unknown;
}): SleeveEase {
  const fit = normalizeSleeveEaseFit(args.fit);
  return SLEEVE_EASE_BY_GROUP[args.sizeGroup][fit];
}

/** Upper-arm circumference ease (inches) for a chart audience and fit. */
export function resolveDropShoulderUpperArmEaseInches(args: {
  chartAudience: unknown;
  fit: unknown;
}): number | undefined {
  const group = dropShoulderSleeveEaseGroupForChartAudience(args.chartAudience);
  if (!group) return undefined;
  return getDefaultSleeveEase({ sizeGroup: group, fit: args.fit }).upperArmInches;
}

/** Wrist circumference ease (inches) for a chart audience and fit. */
export function resolveDropShoulderWristEaseInches(args: {
  chartAudience: unknown;
  fit: unknown;
}): number | undefined {
  const group = dropShoulderSleeveEaseGroupForChartAudience(args.chartAudience);
  if (!group) return undefined;
  return getDefaultSleeveEase({ sizeGroup: group, fit: args.fit }).wristInches;
}

/**
 * Finished Drop Shoulder upper-arm inches = body upper arm + upper-arm ease, rounded to ¼?.
 * Returns `undefined` when ease cannot be resolved or the body measurement is invalid.
 */
export function resolveDropShoulderFinishedUpperArmInches(args: {
  chartAudience: unknown;
  fit: unknown;
  bodyUpperArmIn: number | undefined;
}): number | undefined {
  if (!isPositiveFinite(args.bodyUpperArmIn)) return undefined;
  const upperArmEaseInches = resolveDropShoulderUpperArmEaseInches(args);
  if (upperArmEaseInches === undefined) return undefined;
  return roundQuarter(args.bodyUpperArmIn + upperArmEaseInches);
}

/**
 * Finished Drop Shoulder wrist inches = body wrist + wrist ease, rounded to ¼?.
 * Returns `undefined` when ease cannot be resolved or the body measurement is invalid.
 */
export function resolveDropShoulderFinishedWristInches(args: {
  chartAudience: unknown;
  fit: unknown;
  bodyWristIn: number | undefined;
}): number | undefined {
  if (!isPositiveFinite(args.bodyWristIn)) return undefined;
  const wristEaseInches = resolveDropShoulderWristEaseInches(args);
  if (wristEaseInches === undefined) return undefined;
  return roundQuarter(args.bodyWristIn + wristEaseInches);
}
