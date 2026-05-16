import { approximatePickupStitchesFromRows } from "./machineKnittingPickupRatio";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";

export type SleevelessFinishingStepId =
  | "blockPieces"
  | "joinShoulders"
  | "finishArmholes"
  | "finishFrontEdges"
  | "finishNeckline"
  | "joinSideSeams"
  | "finalPressing";

export const SLEEVELESS_FINISHING_STEP_TITLES: Record<SleevelessFinishingStepId, string> = {
  blockPieces: "Block Pieces (Optional)",
  joinShoulders: "Join Shoulders",
  finishArmholes: "Finish Armholes",
  finishFrontEdges: "Finish Front Edges",
  finishNeckline: "Finish Neckline",
  joinSideSeams: "Join Side Seams",
  finalPressing: "Final Pressing",
};

/**
 * Rows along one cardigan center-front edge from the hem to the neckline bind-off area
 * (garment RC where front neckline shaping begins, minus one).
 */
export function cardiganFrontEdgeRowsFromDebug(debug: {
  frontNecklineStartRC?: number;
}): number | undefined {
  const startRc = debug.frontNecklineStartRC;
  if (!Number.isFinite(startRc)) return undefined;
  return Math.max(1, Math.floor(startRc) - 1);
}

export function cardiganFrontEdgePickupStitchesFromDebug(debug: {
  frontNecklineStartRC?: number;
}): number | undefined {
  const rows = cardiganFrontEdgeRowsFromDebug(debug);
  if (rows === undefined) return undefined;
  return approximatePickupStitchesFromRows(rows);
}

/** Ordered finishing steps; core assembly order matches pattern instructions. */
export function buildSleevelessFinishingStepIds(opts: { isCardigan: boolean }): SleevelessFinishingStepId[] {
  const core: SleevelessFinishingStepId[] = ["joinShoulders", "finishArmholes"];
  if (opts.isCardigan) core.push("finishFrontEdges");
  core.push("finishNeckline", "joinSideSeams");
  return ["blockPieces", ...core, "finalPressing"];
}

export function numberedSleevelessFinishingSteps(opts: {
  isCardigan: boolean;
}): { stepNumber: number; id: SleevelessFinishingStepId; title: string }[] {
  return buildSleevelessFinishingStepIds(opts).map((id, index) => ({
    stepNumber: index + 1,
    id,
    title: SLEEVELESS_FINISHING_STEP_TITLES[id],
  }));
}

export function coreAssemblyFinishingStepIds(opts: {
  isCardigan: boolean;
}): SleevelessFinishingStepId[] {
  return buildSleevelessFinishingStepIds(opts).filter(
    (id) => id !== "blockPieces" && id !== "finalPressing",
  );
}

export function isSleevelessCardiganPattern(patternData: unknown): boolean {
  return isSleevelessCardiganGarmentStyle(patternData);
}

export function sleevelessFinishingFromPattern(
  patternData: unknown,
  debug: { frontNecklineStartRC?: number; cardiganFrontEdgePickupSts?: number },
): {
  isCardigan: boolean;
  frontEdgePickupSts: number | undefined;
  steps: ReturnType<typeof numberedSleevelessFinishingSteps>;
} {
  const isCardigan = isSleevelessCardiganPattern(patternData);
  const frontEdgePickupSts = isCardigan
    ? debug.cardiganFrontEdgePickupSts ?? cardiganFrontEdgePickupStitchesFromDebug(debug)
    : undefined;
  return {
    isCardigan,
    frontEdgePickupSts,
    steps: numberedSleevelessFinishingSteps({ isCardigan }),
  };
}
