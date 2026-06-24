/**
 * Round-neck Japanese notation helpers (center bind-off vs one-side stair/single sequence).
 */

import {
  calculateRoundNecklinePlan,
  calculateRoundNecklineShaping,
  initialCenterNeckStitches,
  normalizeRoundNecklineDepthRows,
} from "./legoBlocks/roundNeckline";
import { roundNeckPlanOneSideNeckEdgeJpLines } from "./roundNeckPlanPresentation";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";

export type RoundNeckNotationSide = "left" | "right";

/** Half-panel neck opening stitches for a round cardigan left/right front. */
export function cardiganFrontNeckOpeningStitches(fullNecklineStitches: number): number {
  return Math.max(1, Math.round(fullNecklineStitches / 2));
}

/**
 * Initial CF-edge bind-off on cardigan front: half of the pullover/back center bind-off
 * for the same full neck opening N (depth-aware when `necklineDepthRows` is provided).
 */
export function cardiganFrontInitialNeckBindOffStitches(
  fullNecklineStitches: number,
  necklineDepthRows?: number,
): number {
  const N = Math.max(0, Math.round(fullNecklineStitches));
  if (N <= 1) return N;

  const fullCenter =
    necklineDepthRows !== undefined && Number.isFinite(necklineDepthRows)
      ? calculateRoundNecklinePlan({
          necklineStitches: N,
          necklineDepthRows: normalizeRoundNecklineDepthRows(necklineDepthRows),
        }).centerBindOff
      : initialCenterNeckStitches(N);

  if (fullCenter <= 1) return Math.max(0, fullCenter);
  return Math.max(1, Math.round(fullCenter / 2));
}

/**
 * Inner-neck stair + single notation for one side of a **full** round neckline plan
 * (excludes center bind-off — that is `jp-neckline-bo` on pullover center or cardigan CF edge).
 */
export function roundNeckOneSideNeckEdgeNotationLines(
  fullNecklineStitches: number,
  side: RoundNeckNotationSide = "right",
  necklineDepthRows?: number,
): string[] {
  const neckSts = Math.max(0, Math.round(fullNecklineStitches));
  if (neckSts <= 2) return [];

  if (necklineDepthRows !== undefined && Number.isFinite(necklineDepthRows)) {
    const plan = calculateRoundNecklinePlan({
      necklineStitches: neckSts,
      necklineDepthRows: normalizeRoundNecklineDepthRows(necklineDepthRows),
    });
    return roundNeckPlanOneSideNeckEdgeJpLines(plan, side);
  }

  const plan = calculateRoundNecklineShaping({ necklineStitches: neckSts });
  const stair = side === "right" ? plan.right.stairSteps : plan.left.stairSteps;
  const singles = side === "right" ? plan.right.singleDecreaseCount : plan.left.singleDecreaseCount;

  const points: StitchDecreasePoint[] = [];
  let relRow = 1;
  for (let i = 0; i < singles; i++) {
    points.push({ row: relRow, amount: 1 });
    relRow += 2;
  }
  const stairAmounts = stair.filter((amount) => amount > 0).sort((a, b) => a - b);
  for (const amount of stairAmounts) {
    points.push({ row: relRow, amount });
    relRow += 1;
  }
  return compressStitchDecreasePointsToNotationLines(points);
}
