import {
  neckbandPickupInstructionFromDebug,
  type NeckbandPickupInstructionViewModel,
  type NeckbandPickupNecklineKind,
} from "./legoBlocks/neckbandPickup";
import { approximatePickupStitchesFromRows } from "./machineKnittingPickupRatio";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";

/** Cardigan center-front edge finishing: horizontal pickup band vs vertical bands (V-neck). */
export type SleevelessCardiganFrontEdgeFinishingMode = "pickup" | "verticalBand";

export type SleevelessFinishingStepId =
  | "blockPieces"
  | "joinShoulders"
  | "finishArmholes"
  | "finishFrontEdges"
  | "finishNeckline"
  | "attachSleeves"
  | "joinSideSeams"
  | "finalPressing";

export const SLEEVELESS_FINISHING_STEP_TITLES: Record<SleevelessFinishingStepId, string> = {
  blockPieces: "Block Pieces (Optional)",
  joinShoulders: "Join Shoulders",
  finishArmholes: "Finish Armholes",
  finishFrontEdges: "Finish Front Edges",
  finishNeckline: "Finish Neckline",
  attachSleeves: "Attach Sleeves",
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

export type SleevelessFinishingStepOptions = {
  isCardigan: boolean;
  /** Drop shoulder has no shaped armhole finishing step. */
  isDropShoulder?: boolean;
};

function isDropShoulderFinishingPattern(patternData: unknown): boolean {
  if (!patternData || typeof patternData !== "object") return false;
  const style = (patternData as { style?: unknown }).style;
  if (!style || typeof style !== "object") return false;
  return hasAuthoritativeDropShoulderConstruction(style as Record<string, unknown>);
}

/** Ordered finishing steps; core assembly order matches pattern instructions. */
export function buildSleevelessFinishingStepIds(opts: SleevelessFinishingStepOptions): SleevelessFinishingStepId[] {
  const core: SleevelessFinishingStepId[] = ["joinShoulders"];
  if (!opts.isDropShoulder) core.push("finishArmholes");
  if (opts.isCardigan) core.push("finishFrontEdges");
  core.push("finishNeckline");
  if (opts.isDropShoulder) core.push("attachSleeves");
  core.push("joinSideSeams");
  return ["blockPieces", ...core, "finalPressing"];
}

export function numberedSleevelessFinishingSteps(
  opts: SleevelessFinishingStepOptions,
): { stepNumber: number; id: SleevelessFinishingStepId; title: string }[] {
  return buildSleevelessFinishingStepIds(opts).map((id, index) => ({
    stepNumber: index + 1,
    id,
    title: SLEEVELESS_FINISHING_STEP_TITLES[id],
  }));
}

export function coreAssemblyFinishingStepIds(opts: SleevelessFinishingStepOptions): SleevelessFinishingStepId[] {
  return buildSleevelessFinishingStepIds(opts).filter(
    (id) => id !== "blockPieces" && id !== "finalPressing",
  );
}

export function isSleevelessCardiganPattern(patternData: unknown): boolean {
  return isSleevelessCardiganGarmentStyle(patternData);
}

/** V-neck cardigans use vertical front bands; round-neck cardigans use horizontal edge pickup. */
export function sleevelessCardiganFrontEdgeFinishingMode(
  patternData: unknown,
): SleevelessCardiganFrontEdgeFinishingMode | undefined {
  if (!isSleevelessCardiganPattern(patternData)) return undefined;
  return isSleevelessVNeckChoice(patternData) ? "verticalBand" : "pickup";
}

/** Resolve V vs round for shared neckband pickup (legacy `v` tokens included). */
export function sleevelessNeckbandPickupNecklineKind(
  patternData: unknown,
): NeckbandPickupNecklineKind {
  return isSleevelessVNeckChoice(patternData) ? "v-neck" : "round";
}

export type SleevelessFinishingNeckbandDebug = {
  frontNecklineStartRC?: number;
  cardiganFrontEdgePickupSts?: number;
  frontNeckDepthRows?: number;
  backNeckDepthRows?: number;
  stitchesPerInch?: number;
  rowsPerInch?: number;
  frontCenterNeckBindOffStitches?: number;
  centerNeckBindOffStitches?: number;
};

export function sleevelessFinishingFromPattern(
  patternData: unknown,
  debug: SleevelessFinishingNeckbandDebug,
): {
  isCardigan: boolean;
  isDropShoulder: boolean;
  cardiganFrontEdgeFinishingMode: SleevelessCardiganFrontEdgeFinishingMode | undefined;
  frontEdgePickupSts: number | undefined;
  neckbandPickup: NeckbandPickupInstructionViewModel | null;
  steps: ReturnType<typeof numberedSleevelessFinishingSteps>;
} {
  const isCardigan = isSleevelessCardiganPattern(patternData);
  const isDropShoulder = isDropShoulderFinishingPattern(patternData);
  const cardiganFrontEdgeFinishingMode = sleevelessCardiganFrontEdgeFinishingMode(patternData);
  const frontEdgePickupSts =
    isCardigan && cardiganFrontEdgeFinishingMode === "pickup"
      ? debug.cardiganFrontEdgePickupSts ?? cardiganFrontEdgePickupStitchesFromDebug(debug)
      : undefined;
  const neckbandPickup = neckbandPickupInstructionFromDebug(
    sleevelessNeckbandPickupNecklineKind(patternData),
    debug,
  );
  return {
    isCardigan,
    isDropShoulder,
    cardiganFrontEdgeFinishingMode,
    frontEdgePickupSts,
    neckbandPickup,
    steps: numberedSleevelessFinishingSteps({ isCardigan, isDropShoulder }),
  };
}
