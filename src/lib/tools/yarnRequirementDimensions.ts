/**
 * Shared yarn-requirement dimensions contract (YarnRequirement embed).
 * Pattern pages push finished size via `kbm:yarnDimensions`; optional fabric area
 * overrides W×L when construction needs more/less than a plain rectangle.
 */

/** 10% buffer applied by YarnRequirement for tails, knots, and re-knitting. */
export const YARN_REQUIREMENT_BUFFER = 1.1;

export type YarnDimensionsLengthUnit = "in" | "cm";

export type YarnDimensionsSource = "sample" | "custom";

/**
 * Detail payload for `kbm:yarnDimensions`.
 * `projectWidth` / `projectLength` are in `lengthUnit` (finished garment size for display).
 * When `projectAreaSquareInches` is set and > 0, the estimator uses that area instead of W×L.
 */
export type YarnDimensionsDetail = {
  projectWidth: number;
  projectLength: number;
  lengthUnit: YarnDimensionsLengthUnit;
  source?: YarnDimensionsSource;
  /** Explicit knitted fabric area in square inches (optional). */
  projectAreaSquareInches?: number;
};

export const YARN_DIMENSIONS_EVENT = "kbm:yarnDimensions";

/** Density × area × buffer — same formula as YarnRequirement.astro (weight unit unchanged). */
export function estimateYarnWeightWithBuffer(args: {
  swatchWidthInches: number;
  swatchLengthInches: number;
  swatchWeight: number;
  projectAreaSquareInches: number;
  buffer?: number;
}): number {
  const swatchArea = args.swatchWidthInches * args.swatchLengthInches;
  if (!(swatchArea > 0) || !(args.projectAreaSquareInches > 0) || !(args.swatchWeight > 0)) {
    return 0;
  }
  const buffer = args.buffer ?? YARN_REQUIREMENT_BUFFER;
  return (args.swatchWeight / swatchArea) * args.projectAreaSquareInches * buffer;
}

/** Resolve project area in square inches from W×L and optional explicit area override. */
export function resolveYarnProjectAreaSquareInches(args: {
  widthInches: number;
  lengthInches: number;
  projectAreaSquareInches?: number;
}): number {
  const explicit = args.projectAreaSquareInches;
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const w = args.widthInches;
  const l = args.lengthInches;
  if (!(w > 0) || !(l > 0)) return 0;
  return w * l;
}
