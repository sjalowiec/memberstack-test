/**
 * Drop Shoulder — fit-based upper-arm ALLOWANCE (single source of truth).
 *
 * This allowance is NOT ordinary bicep wearing ease. It is added to the sizing-chart body
 * upper-arm measurement to produce the finished Drop Shoulder upper-arm value, and that finished
 * value establishes BOTH the sleeve-top width AND the Drop Shoulder armhole geometry
 * (armhole depth = finished upper arm ÷ 2). It is therefore a construction allowance.
 *
 * Owns everything about the allowance so the builder, review diagram, and generator never
 * reimplement the table:
 *  - allowance profiles per sizing group,
 *  - linear interpolation + clamping for Baby and Kids,
 *  - audience ? group mapping,
 *  - fit-identifier normalization (persisted `relaxed` maps to Oversized),
 *  - finished upper-arm calculation (body upper arm + allowance).
 */

export type DropShoulderAllowanceFit = "close" | "standard" | "oversized";
export type DropShoulderAllowanceGroup = "baby" | "kids" | "woman" | "man";

type FitTriple = Record<DropShoulderAllowanceFit, number>;
type AllowanceAnchor = FitTriple & { bodyUpperArmIn: number };

/** Baby profile — interpolate by body upper arm between these anchors (clamp outside the range). */
const BABY_ANCHORS: readonly AllowanceAnchor[] = [
  { bodyUpperArmIn: 5.7, close: 1.4, standard: 1.6, oversized: 2.2 },
  { bodyUpperArmIn: 6.1, close: 1.8, standard: 2.4, oversized: 3.3 },
  { bodyUpperArmIn: 6.7, close: 1.8, standard: 3.2, oversized: 4.0 },
];

/** Kids profile — interpolate by body upper arm between these anchors (clamp outside the range). */
const KIDS_ANCHORS: readonly AllowanceAnchor[] = [
  { bodyUpperArmIn: 6.9, close: 1.8, standard: 3.3, oversized: 4.3 },
  { bodyUpperArmIn: 8.3, close: 3.2, standard: 4.5, oversized: 6.3 },
  { bodyUpperArmIn: 10.0, close: 3.9, standard: 5.5, oversized: 7.9 },
];

/** Adult woman profile — fixed allowance regardless of body upper arm (Misses + Plus). */
const WOMAN_FIXED: FitTriple = { close: 7.1, standard: 8.7, oversized: 10.2 };

/** Adult man profile — fixed allowance regardless of body upper arm (Men). */
const MAN_FIXED: FitTriple = { close: 3.9, standard: 5.5, oversized: 7.1 };

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Normalize a fit identifier to an allowance fit. The persisted identifier is `relaxed`; it (and
 * the user-facing `oversized`) both map to the Oversized allowance. Anything else falls back to
 * Standard.
 */
export function normalizeDropShoulderAllowanceFit(fit: unknown): DropShoulderAllowanceFit {
  const raw = String(fit ?? "").trim().toLowerCase();
  if (raw === "close") return "close";
  if (raw === "oversized" || raw === "relaxed") return "oversized";
  return "standard";
}

/**
 * Map a repo sizing audience / chart identity to an allowance profile group. Returns `undefined`
 * for unrecognized audiences so callers can fall back to the raw body measurement rather than
 * guessing the group from the number.
 *
 * Baby ? Baby, Kids ? Kids, Misses ? Adult woman, Plus ? Adult woman, Men ? Adult man.
 */
export function dropShoulderAllowanceGroupForChartAudience(
  chartAudience: unknown,
): DropShoulderAllowanceGroup | undefined {
  const raw = String(chartAudience ?? "").trim().toLowerCase();
  switch (raw) {
    case "baby":
      return "baby";
    case "kids":
    case "kid":
      return "kids";
    case "misses":
    case "plus":
    case "women":
    case "woman":
      return "woman";
    case "men":
    case "man":
      return "man";
    default:
      return undefined;
  }
}

/** Linear interpolation of one fit column across anchors, clamped to the anchor range. */
function interpolateAnchorAllowance(
  anchors: readonly AllowanceAnchor[],
  bodyUpperArmIn: number,
  fit: DropShoulderAllowanceFit,
): number {
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (bodyUpperArmIn <= first.bodyUpperArmIn) return first[fit];
  if (bodyUpperArmIn >= last.bodyUpperArmIn) return last[fit];

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const lo = anchors[i]!;
    const hi = anchors[i + 1]!;
    if (bodyUpperArmIn >= lo.bodyUpperArmIn && bodyUpperArmIn <= hi.bodyUpperArmIn) {
      const span = hi.bodyUpperArmIn - lo.bodyUpperArmIn;
      if (span <= 0) return lo[fit];
      const t = (bodyUpperArmIn - lo.bodyUpperArmIn) / span;
      return lo[fit] + t * (hi[fit] - lo[fit]);
    }
  }
  return last[fit];
}

/**
 * The Drop Shoulder upper-arm allowance (inches) for a group + fit + body upper arm. Returns the
 * raw (unrounded) allowance so callers can round the finished value once. Returns `undefined` when
 * the group is unknown or the body measurement is missing/invalid.
 */
export function resolveDropShoulderUpperArmAllowanceInches(args: {
  chartAudience: unknown;
  fit: unknown;
  bodyUpperArmIn: number | undefined;
}): number | undefined {
  const group = dropShoulderAllowanceGroupForChartAudience(args.chartAudience);
  if (!group) return undefined;
  const fit = normalizeDropShoulderAllowanceFit(args.fit);

  if (group === "woman") return WOMAN_FIXED[fit];
  if (group === "man") return MAN_FIXED[fit];

  // Baby / Kids interpolate by body upper arm.
  if (!isPositiveFinite(args.bodyUpperArmIn)) return undefined;
  const anchors = group === "baby" ? BABY_ANCHORS : KIDS_ANCHORS;
  return interpolateAnchorAllowance(anchors, args.bodyUpperArmIn, fit);
}

/**
 * Finished Drop Shoulder upper-arm inches = body upper arm + allowance, rounded to the nearest ¼?
 * (the builder's standard measurement rounding). Returns `undefined` when the allowance cannot be
 * resolved (unknown group) or the body measurement is invalid — callers then keep the body value.
 */
export function resolveDropShoulderFinishedUpperArmInches(args: {
  chartAudience: unknown;
  fit: unknown;
  bodyUpperArmIn: number | undefined;
}): number | undefined {
  if (!isPositiveFinite(args.bodyUpperArmIn)) return undefined;
  const allowance = resolveDropShoulderUpperArmAllowanceInches(args);
  if (allowance === undefined) return undefined;
  return roundQuarter(args.bodyUpperArmIn + allowance);
}
