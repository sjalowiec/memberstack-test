export type NecklineStep = {
  stitches: number;
  times: number;
};

export {
  calculateRoundNecklinePlan,
  calculateRoundNecklineShaping,
  minRowsForBalancedEdgeRemainder,
  partitionNecklineThirds,
  rowsRequiredForDeepPlan,
  stairBindOffStepsForSide,
  type RoundNecklinePlanResult,
  type RoundNecklineShapingResult,
  type RoundNecklineSidePlan,
  type RoundNecklineStrategy,
} from "./roundNeckline";

/**
 * V-neck Lego-block API, re-exported alongside round-neck for a single neckline-shaping import
 * surface. Round-neck behavior is unchanged; consumers selecting V-neck call `buildVNecklinePlan`.
 *
 * To adjust V-neck math after Sue confirms numbers, edit `./vNeckline` (per-side stitch budget +
 * row distribution) — this re-export shape stays stable for chart/SVG/instruction builders.
 */
export {
  buildVNecklinePlan,
  calculateVNeckNeckEdgePlan,
  neckDecreaseStitchesPerSideFromOpening,
  vNeckPlanToInnerEdgeEventsByRow,
  type BuildVNecklinePlanInputs,
  type VNecklinePlan,
  type VNeckNeckEdgeInputs,
  type VNeckNeckEdgePlan,
} from "./vNeckline";

export {
  buildVNeckShoulderEventsByRow,
  type BuildVNeckShoulderEventsByRowOptions,
} from "./vNeckShoulderBridge";

/**
 * Distribute a known neck-edge decrease total evenly across `steps` (remainder spaced first).
 * Legacy helper for even spacing; round-neck source of truth is {@link calculateRoundNecklineShaping}.
 */
export function calculateNecklineShaping(stitches: number, steps: number): NecklineStep[] {
  if (!Number.isFinite(stitches) || !Number.isFinite(steps)) return [];
  if (stitches <= 0 || steps <= 0) return [];

  const totalStitches = Math.round(stitches);
  const totalSteps = Math.floor(steps);

  const base = Math.floor(totalStitches / totalSteps);
  const remainder = totalStitches % totalSteps;

  const stepsArr: NecklineStep[] = [];

  if (remainder > 0) {
    stepsArr.push({ stitches: base + 1, times: remainder });
  }

  if (totalSteps - remainder > 0 && base > 0) {
    stepsArr.push({ stitches: base, times: totalSteps - remainder });
  }

  return stepsArr;
}
