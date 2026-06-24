import { roundUpToEvenRows } from "../hemDefaults";

/**
 * Round neckline (LEGO): total neckline width N splits into three ~equal phases —
 * center bind-off/hold, neck-edge stair bind-offs (2s and 3s, larger groups first), and
 * single neck-edge decreases — same stair sequence and per-side singles left/right.
 */

/**
 * Force neckline depth to an even row count (machine-knit pairs). Odd calculated depths
 * round up to the next even value; zero/invalid stays zero.
 */
export function normalizeRoundNecklineDepthRows(rows: number): number {
  if (!Number.isFinite(rows) || rows <= 0) return 0;
  return roundUpToEvenRows(Math.floor(rows));
}
export type RoundNecklineSidePlan = {
  /** Neck-edge stair bind-offs (each value is 2 or 3); 3-stitch steps come before 2-stitch steps. */
  stairSteps: number[];
  /** Single-stitch decreases at the neck edge (deep-round every-other-row singles). */
  singleDecreaseCount: number;
  /**
   * Shallow short-row hold: stitches placed on hold at the neck edge per action row
   * (every other row; one entry per shaping opportunity).
   */
  holdGroups: number[];
};

export type RoundNecklineShapingResult = {
  necklineStitches: number;
  centerBindOff: number;
  left: RoundNecklineSidePlan;
  right: RoundNecklineSidePlan;
  /** Sum of center + all neck-edge removals; must equal `necklineStitches`. */
  totalCheck: number;
};

export type RoundNecklineStrategy = "deep-round" | "shallow-round";

export type RoundNecklinePlanResult = {
  strategy: RoundNecklineStrategy;
  necklineStitches: number;
  necklineDepthRows: number;
  centerBindOff: number;
  left: RoundNecklineSidePlan;
  right: RoundNecklineSidePlan;
  rowsRequired: number;
  fitsAvailableRows: boolean;
  warnings: string[];
  totalCheck: number;
};

function emptySidePlan(): RoundNecklineSidePlan {
  return { stairSteps: [], singleDecreaseCount: 0, holdGroups: [] };
}

/** Shallow machine-knit round neck (no stair bind-offs; hold-based short rows). */
export function isShallowHoldRoundPlan(
  plan: Pick<RoundNecklineShapingResult, "left" | "right"> & {
    strategy?: RoundNecklineStrategy;
  },
): boolean {
  if (plan.strategy === "shallow-round") return true;
  if (plan.strategy === "deep-round") return false;
  return (
    plan.left.stairSteps.length === 0 &&
    plan.right.stairSteps.length === 0 &&
    plan.left.singleDecreaseCount === 0 &&
    plan.right.singleDecreaseCount === 0 &&
    (plan.left.holdGroups.length > 0 || plan.right.holdGroups.length > 0)
  );
}

/**
 * Distribute `totalStitches` across `opportunities` every-other-row hold actions (≥1 st each when R > K).
 */
export function distributeHoldGroupsPerSide(totalStitches: number, opportunities: number): number[] {
  const R = Math.max(0, Math.round(totalStitches));
  const K = Math.max(0, Math.floor(opportunities));
  if (R === 0 || K === 0) return [];
  if (R <= K) {
    return Array.from({ length: R }, () => 1);
  }
  const groups = Array.from({ length: K }, () => 1);
  const extra = R - K;
  for (let i = 0; i < extra; i++) {
    groups[i % K]! += 1;
  }
  return groups;
}

/** Compress consecutive equal hold groups into Xs-2r-Nx segments. */
export function compressHoldGroupsToSegments(
  groups: readonly number[],
): { stitchCount: number; repeatCount: number }[] {
  const out: { stitchCount: number; repeatCount: number }[] = [];
  for (const g of groups) {
    if (g <= 0) continue;
    const last = out[out.length - 1];
    if (last && last.stitchCount === g) {
      last.repeatCount += 1;
    } else {
      out.push({ stitchCount: g, repeatCount: 1 });
    }
  }
  return out;
}

function buildShallowHoldSidePlan(perSideStitches: number, opportunities: number): RoundNecklineSidePlan {
  const holdGroups = distributeHoldGroupsPerSide(perSideStitches, opportunities);
  return { stairSteps: [], singleDecreaseCount: 0, holdGroups };
}

function shallowHoldActionsCount(plan: RoundNecklineShapingResult): number {
  return Math.max(plan.left.holdGroups.length, plan.right.holdGroups.length);
}
export function partitionNecklineThirds(n: number): [number, number, number] {
  const N = Math.max(0, Math.round(n));
  if (N === 0) return [0, 0, 0];
  const q = Math.floor(N / 3);
  const r = N % 3;
  const center = q + (r >= 1 ? 1 : 0);
  const stairTotal = q + (r >= 2 ? 1 : 0);
  const singlesTotal = N - center - stairTotal;
  return [center, stairTotal, singlesTotal];
}

/**
 * Build stair bind-off steps for one side using only 2- and 3-stitch groups; all 3s before all 2s.
 */
export function stairBindOffStepsForSide(stitches: number): number[] {
  const s = Math.max(0, Math.round(stitches));
  if (s === 0) return [];
  if (s === 1) return [];

  const out: number[] = [];
  let r = s;
  while (r > 0) {
    const canFinish = (n: number): boolean => n === 0 || n >= 2;
    if (r >= 3 && canFinish(r - 3)) {
      out.push(3);
      r -= 3;
    } else if (r >= 2 && canFinish(r - 2)) {
      out.push(2);
      r -= 2;
    } else {
      break;
    }
  }
  return out;
}

function sumSteps(steps: number[]): number {
  return steps.reduce((a, b) => a + b, 0);
}

/** Center bind-off nearest to N/3 such that (N − center) is divisible by 4 (stair/singles split evenly per side). */
function pickCenterBindOffForThirds(neckSts: number): number {
  const rawCenter = Math.round(neckSts / 3);
  let best = rawCenter;
  let bestDist = Infinity;
  for (let c = 0; c <= neckSts; c++) {
    if (((neckSts - c) % 4 + 4) % 4 !== 0) continue;
    const d = Math.abs(c - rawCenter);
    if (d < bestDist || (d === bestDist && c < best)) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** Per-side stair-step groups using mostly 2s and 3s; larger groups first. */
export function distributeStairGroups(sts: number): number[] {
  if (sts <= 0) return [];

  if (sts === 1) {
    throw new Error(
      "Invalid stair group size: 1. Move this stitch into single decreases instead."
    );
  }

  if (sts === 2) return [2];
  if (sts === 3) return [3];
  if (sts === 4) return [2, 2];

  const mod = sts % 3;

  if (mod === 0) {
    return Array(sts / 3).fill(3);
  }

  if (mod === 2) {
    return [...Array(Math.floor(sts / 3)).fill(3), 2];
  }

  // mod === 1: avoid a group of 1 by using two 2s at the end
  return [...Array(Math.floor((sts - 4) / 3)).fill(3), 2, 2];
}

/**
 * Documented shallow round neck stitch budget (machine-knit): center ≈ 50% of N,
 * remaining stitches removed as single decreases at each neck edge every other row
 * (no stair bind-offs).
 */
export function calculateDocumentedShallowRoundNecklineShaping(inputs: {
  necklineStitches: number;
  /** When set, hold groups are depth-constrained (shapingOpportunities = depth / 2). */
  necklineDepthRows?: number;
}): RoundNecklineShapingResult {
  const N = Math.max(0, Math.round(inputs.necklineStitches));

  if (N === 0) {
    return {
      necklineStitches: 0,
      centerBindOff: 0,
      left: emptySidePlan(),
      right: emptySidePlan(),
      totalCheck: 0,
    };
  }

  if (N <= 2) {
    return {
      necklineStitches: N,
      centerBindOff: N,
      left: emptySidePlan(),
      right: emptySidePlan(),
      totalCheck: N,
    };
  }

  const center = Math.floor(N / 2);
  const remaining = N - center;
  const [leftR, rightR] = splitBalancedPair(remaining);
  const depthNorm =
    inputs.necklineDepthRows !== undefined
      ? normalizeRoundNecklineDepthRows(inputs.necklineDepthRows)
      : 0;
  const opportunities =
    depthNorm > 0 ? depthNorm / 2 : Math.max(leftR, rightR, 1);
  const left = buildShallowHoldSidePlan(leftR, opportunities);
  const right = buildShallowHoldSidePlan(rightR, opportunities);
  const totalCheck = center + sumHoldGroups(left) + sumHoldGroups(right);

  return {
    necklineStitches: N,
    centerBindOff: center,
    left,
    right,
    totalCheck,
  };
}

function sumHoldGroups(side: RoundNecklineSidePlan): number {
  return side.holdGroups.reduce((a, b) => a + b, 0);
}

/**
 * Rows for documented shallow round neck: center hold row + hold groups every other row.
 */
export function rowsRequiredForShallowPlan(plan: RoundNecklineShapingResult): number {
  const N = plan.necklineStitches;
  if (N <= 0) return 0;
  if (N <= 2) return 1;

  const actions = shallowHoldActionsCount(plan);
  return actions > 0 ? 1 + 2 * actions - 1 : 1;
}

/** @deprecated Alias — shallow back and front use the same every-other-row row count. */
export const rowsRequiredForBackShallowPlan = rowsRequiredForShallowPlan;

/**
 * Rows needed for the deep 3-phase schedule: center row +
 * one row per paired stair-step row +
 * every-other-row spacing for single decreases (shared timeline).
 */
export function rowsRequiredForDeepPlan(plan: RoundNecklineShapingResult): number {
  const N = plan.necklineStitches;
  if (N <= 0) return 0;
  if (N <= 2) return 1;

  const stairRows = Math.max(plan.left.stairSteps.length, plan.right.stairSteps.length);
  const maxSingles = Math.max(
    plan.left.singleDecreaseCount,
    plan.right.singleDecreaseCount
  );
  const singlesSpanRows = maxSingles > 0 ? 2 * maxSingles - 1 : 0;
  return 1 + stairRows + singlesSpanRows;
}

type EdgeSplit = { left: RoundNecklineSidePlan; right: RoundNecklineSidePlan; postRows: number };

/**
 * Minimum post-center row count for a balanced edge remainder E (and one concrete split).
 */
export function minRowsForBalancedEdgeRemainder(edgeTotal: number): EdgeSplit {
  const E = Math.max(0, Math.round(edgeTotal));
  if (E === 0) {
    return {
      left: { stairSteps: [], singleDecreaseCount: 0, holdGroups: [] },
      right: { stairSteps: [], singleDecreaseCount: 0, holdGroups: [] },
      postRows: 0,
    };
  }

  const el = Math.floor(E / 2);
  const er = E - el;

  let bestPost = Infinity;
  let bestLeft: RoundNecklineSidePlan = {
    stairSteps: [],
    singleDecreaseCount: el,
    holdGroups: [],
  };
  let bestRight: RoundNecklineSidePlan = {
    stairSteps: [],
    singleDecreaseCount: er,
    holdGroups: [],
  };

  for (let tL = 0; tL <= el; tL++) {
    const sL = el - tL;
    if (tL === 1) continue;
    if (tL > 0 && sumSteps(stairBindOffStepsForSide(tL)) !== tL) continue;

    for (let tR = 0; tR <= er; tR++) {
      const sR = er - tR;
      if (tR === 1) continue;
      if (tR > 0 && sumSteps(stairBindOffStepsForSide(tR)) !== tR) continue;

      const ls = stairBindOffStepsForSide(tL);
      const rs = stairBindOffStepsForSide(tR);
      const stairLen = Math.max(ls.length, rs.length);
      const m = Math.max(sL, sR);
      const post = stairLen + (m > 0 ? 2 * m - 1 : 0);

      if (post < bestPost) {
        bestPost = post;
        bestLeft = { stairSteps: ls, singleDecreaseCount: sL, holdGroups: [] };
        bestRight = { stairSteps: rs, singleDecreaseCount: sR, holdGroups: [] };
      }
    }
  }

  return { left: bestLeft, right: bestRight, postRows: bestPost };
}

function buildDocumentedShallowRoundPlan(
  necklineStitches: number,
  necklineDepthRows: number,
): Omit<RoundNecklinePlanResult, "strategy" | "necklineDepthRows"> {
  const N = Math.max(0, Math.round(necklineStitches));
  const depth = normalizeRoundNecklineDepthRows(necklineDepthRows);
  const warnings: string[] = [];

  if (N === 0) {
    return {
      necklineStitches: 0,
      centerBindOff: 0,
      left: emptySidePlan(),
      right: emptySidePlan(),
      rowsRequired: 0,
      fitsAvailableRows: depth >= 0,
      warnings,
      totalCheck: 0,
    };
  }

  if (depth < 1) {
    warnings.push(
      "necklineDepthRows must be at least 1 to work any neckline shaping; row budget is treated as insufficient.",
    );
  }

  const shallow = calculateDocumentedShallowRoundNecklineShaping({
    necklineStitches: N,
    necklineDepthRows: depth,
  });
  const rowsRequired = rowsRequiredForShallowPlan(shallow);
  const opportunities = depth > 0 ? depth / 2 : 0;

  if (depth > 0 && opportunities <= 0) {
    warnings.push("necklineDepthRows must allow at least one shaping opportunity (even depth ≥ 2).");
  }

  if (depth > 0 && depth < rowsRequired) {
    warnings.push(
      `necklineDepthRows (${depth}) is fewer than the ${rowsRequired} rows required for the documented shallow round neckline hold plan.`,
    );
  }

  return {
    necklineStitches: N,
    centerBindOff: shallow.centerBindOff,
    left: shallow.left,
    right: shallow.right,
    rowsRequired,
    fitsAvailableRows: depth >= rowsRequired,
    warnings,
    totalCheck: shallow.totalCheck,
  };
}

/**
 * Choose deep-round vs shallow-round from stitch count and available neckline rows only
 * (no garment piece / front / back).
 */
export function calculateRoundNecklinePlan(inputs: {
  necklineStitches: number;
  necklineDepthRows: number;
}): RoundNecklinePlanResult {
  const N = Math.max(0, Math.round(inputs.necklineStitches));
  const depthRows = normalizeRoundNecklineDepthRows(inputs.necklineDepthRows);

  if (N === 0) {
    return {
      strategy: "deep-round",
      necklineStitches: 0,
      necklineDepthRows: depthRows,
      centerBindOff: 0,
      left: emptySidePlan(),
      right: emptySidePlan(),
      rowsRequired: 0,
      fitsAvailableRows: depthRows >= 0,
      warnings: [],
      totalCheck: 0,
    };
  }

  const deep = calculateRoundNecklineShaping({ necklineStitches: N });
  const rowsDeep = rowsRequiredForDeepPlan(deep);

  if (depthRows >= rowsDeep) {
    return {
      strategy: "deep-round",
      necklineStitches: N,
      necklineDepthRows: depthRows,
      centerBindOff: deep.centerBindOff,
      left: deep.left,
      right: deep.right,
      rowsRequired: rowsDeep,
      fitsAvailableRows: true,
      warnings: [],
      totalCheck: deep.totalCheck,
    };
  }

  const shallow = buildDocumentedShallowRoundPlan(N, depthRows);
  const w = [
    ...shallow.warnings,
    `necklineDepthRows (${depthRows}) is fewer than the ${rowsDeep} rows required for a full deep 3-phase round neckline; using documented shallow-round (center ≈ 50%, short-row hold shaping every other row).`,
  ];

  return {
    strategy: "shallow-round",
    necklineStitches: N,
    necklineDepthRows: depthRows,
    centerBindOff: shallow.centerBindOff,
    left: shallow.left,
    right: shallow.right,
    rowsRequired: shallow.rowsRequired,
    fitsAvailableRows: shallow.fitsAvailableRows,
    warnings: w,
    totalCheck: shallow.totalCheck,
  };
}

/** Split `total` into [floor, ceil] so the two parts differ by at most 1. */
export function splitBalancedPair(total: number): [number, number] {
  const t = Math.max(0, Math.round(total));
  const a = Math.floor(t / 2);
  return [a, t - a];
}

function sideDecomposesWithTwoAndThreeOnly(ls: number, rs: number): boolean {
  return (
    sumSteps(stairBindOffStepsForSide(ls)) === ls && sumSteps(stairBindOffStepsForSide(rs)) === rs
  );
}

/**
 * Assign stair stitches to left/right (≤1 apart), folding impossible cases into singles.
 */
export function resolveRoundNeckStairSingles(
  stairTotal: number,
  singlesTotal: number
): { leftStair: number; rightStair: number; leftSingles: number; rightSingles: number } {
  let st = Math.max(0, Math.round(stairTotal));
  let sg = Math.max(0, Math.round(singlesTotal));

  for (let guard = 0; guard < 32; guard++) {
    if (st === 0) break;
    const [ls, rs] = splitBalancedPair(st);
    if (st === 2 && ls === 1 && rs === 1) {
      sg += 2;
      st = 0;
      break;
    }
    if (ls === 1) {
      st -= 1;
      sg += 1;
      continue;
    }
    if (rs === 1) {
      st -= 1;
      sg += 1;
      continue;
    }
    if (!sideDecomposesWithTwoAndThreeOnly(ls, rs)) {
      sg += st;
      st = 0;
    }
    break;
  }

  const [lsFin, rsFin] = splitBalancedPair(st);
  const [sl, sr] = splitBalancedPair(sg);
  return { leftStair: lsFin, rightStair: rsFin, leftSingles: sl, rightSingles: sr };
}

/**
 * Source of truth for round neckline shaping: ~1/3 center, ~1/3 stair bind-offs at neck edges (total),
 * ~1/3 single neck-edge decreases (total); stair and singles each split evenly left/right; same stair
 * sequence on both sides.
 *
 * Odd `necklineStitches` values are supported: center is chosen nearest to N/3 with (N − center) divisible
 * by 4 so stair/single totals split cleanly per side. For product rules that require an **even** neck
 * opening only, round to the nearest even count before calling (some callers already enforce this when
 * converting inches to stitches).
 */
export function calculateRoundNecklineShaping(inputs: {
  necklineStitches: number;
}): RoundNecklineShapingResult {
  const neckSts = Math.max(0, Math.round(inputs.necklineStitches));

  if (neckSts === 0) {
    return {
      necklineStitches: 0,
      centerBindOff: 0,
      left: emptySidePlan(),
      right: emptySidePlan(),
      totalCheck: 0,
    };
  }

  if (neckSts <= 2) {
    return {
      necklineStitches: neckSts,
      centerBindOff: neckSts,
      left: emptySidePlan(),
      right: emptySidePlan(),
      totalCheck: neckSts,
    };
  }

  let center = pickCenterBindOffForThirds(neckSts);
  let remaining = neckSts - center;
  const stairTotal = remaining / 2;
  const singleTotal = remaining / 2;
  let stairPerSide = stairTotal / 2;
  let singlePerSide = singleTotal / 2;

  // Cannot form a stair row of 1 st/side — fold into single decreases.
  if (stairPerSide === 1) {
    stairPerSide = 0;
    singlePerSide += 1;
  }

  let stairGroups: number[] = [];
  if (stairPerSide > 0) {
    stairGroups = distributeStairGroups(stairPerSide);
  }

  const check =
    center + stairPerSide * 2 + singlePerSide * 2;

  if (check !== neckSts) {
    throw new Error(
      `Neck shaping math error: ${center} + ${stairPerSide * 2} + ${singlePerSide * 2} = ${check}, expected ${neckSts}`
    );
  }

  return {
    necklineStitches: neckSts,
    centerBindOff: center,
    left: {
      stairSteps: [...stairGroups],
      singleDecreaseCount: singlePerSide,
      holdGroups: [],
    },
    right: {
      stairSteps: [...stairGroups],
      singleDecreaseCount: singlePerSide,
      holdGroups: [],
    },
    totalCheck: check,
  };
}

/** Center bind-off / hold count from the deep round-neck plan (front / full deep planner). */
export function initialCenterNeckStitches(necklineStitches: number): number {
  return calculateRoundNecklineShaping({ necklineStitches }).centerBindOff;
}

/** Center bind-off for back necklines — always documented shallow (≈ N ÷ 2). */
export function initialBackCenterNeckStitches(necklineStitches: number): number {
  return calculateDocumentedShallowRoundNecklineShaping({ necklineStitches }).centerBindOff;
}

/**
 * Back neck plan — always documented shallow-round (singles only, every other row; depth used for validation only).
 */
export function calculateBackRoundNecklinePlan(inputs: {
  necklineStitches: number;
  necklineDepthRows: number;
}): RoundNecklinePlanResult {
  const depthRows = normalizeRoundNecklineDepthRows(inputs.necklineDepthRows);
  const shallow = buildDocumentedShallowRoundPlan(inputs.necklineStitches, depthRows);
  return {
    strategy: "shallow-round",
    necklineStitches: shallow.necklineStitches,
    necklineDepthRows: depthRows,
    centerBindOff: shallow.centerBindOff,
    left: shallow.left,
    right: shallow.right,
    rowsRequired: shallow.rowsRequired,
    fitsAvailableRows: shallow.fitsAvailableRows,
    warnings: shallow.warnings,
    totalCheck: shallow.totalCheck,
  };
}

/** Total neck-edge hold stitches per side on back (documented shallow short-row plan). */
export function backNeckEdgeDecreasesPerSide(necklineStitches: number): number {
  const p = calculateDocumentedShallowRoundNecklineShaping({ necklineStitches });
  return Math.max(sumHoldGroups(p.left), sumHoldGroups(p.right));
}

/** Depth-aware back neck-edge hold stitches per side (heavier side). */
export function backNeckEdgeHoldStitchesPerSide(
  necklineStitches: number,
  necklineDepthRows: number,
): number {
  const p = calculateDocumentedShallowRoundNecklineShaping({
    necklineStitches,
    necklineDepthRows,
  });
  return Math.max(sumHoldGroups(p.left), sumHoldGroups(p.right));
}

/**
 * Total neck-edge stitches removed on the heavier side (stair + singles); used for front timeline row budgets.
 */
export function neckEdgeDecreasesPerSide(necklineStitches: number): number {
  const p = calculateRoundNecklineShaping({ necklineStitches });
  const leftTotal = sumSteps(p.left.stairSteps) + p.left.singleDecreaseCount;
  const rightTotal = sumSteps(p.right.stairSteps) + p.right.singleDecreaseCount;
  return Math.max(leftTotal, rightTotal);
}
