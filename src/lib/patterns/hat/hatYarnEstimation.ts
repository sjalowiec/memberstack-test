/**
 * Hat → YarnRequirement bridge: fabric area from HatPatternCalc (draft math source of truth).
 *
 * Finished circumference and total length are passed through for display; knitted area
 * accounts for brim construction and crown shaping so the shared estimator is not a
 * naive finished rectangle when that would mis-count yarn.
 */

import { hatKnittedFinishedCircumferenceInches, type HatPatternCalc } from "./hatMath";
import type { YarnDimensionsDetail, YarnDimensionsLengthUnit } from "../../tools/yarnRequirementDimensions";

/**
 * Knitted brim fabric layers.
 * Folded Hem and hung hem include the hidden turn-under layer; rolled/single are one layer.
 */
export function hatBrimFabricLayerCount(brimType: string): number {
  if (brimType === "folded" || brimType === "hung-hem") return 2;
  return 1;
}

/** Visible brim depth × layer count (hung hem / folded = 2×). */
export function hatBrimKnittedDepthInches(args: {
  visibleBrimDepthInches: number;
  brimType: string;
}): number {
  const visible = args.visibleBrimDepthInches;
  if (!(visible > 0)) return 0;
  return visible * hatBrimFabricLayerCount(args.brimType);
}

/**
 * Crown yarn height in the W×L area model.
 * Shaped crowns (wedge / spiral) taper roughly cast-on → near zero → half rectangle.
 * Gathered crowns have no shaped crown depth in hat math.
 */
export function hatCrownYarnEquivalentHeightInches(calc: HatPatternCalc): number {
  if (!(calc.rowGaugePerInch > 0)) return 0;
  if (calc.crown === "gathered" || calc.crownHeightInches <= 0 || calc.crownRowCount <= 0) {
    return 0;
  }
  return (calc.crownRowCount / calc.rowGaugePerInch) * 0.5;
}

/** Brim / body / crown knitted heights (inches) derived from pattern row counts. */
export function hatYarnFabricHeightsInches(calc: HatPatternCalc): {
  brimInches: number;
  bodyInches: number;
  crownInches: number;
  totalInches: number;
} {
  const g = calc.rowGaugePerInch;
  const brimInches = g > 0 ? calc.brimRows / g : 0;
  const bodyInches = g > 0 ? calc.bodyRows / g : 0;
  const crownInches = hatCrownYarnEquivalentHeightInches(calc);
  return {
    brimInches,
    bodyInches,
    crownInches,
    totalInches: brimInches + bodyInches + crownInches,
  };
}

/** Total knitted fabric area (sq in) for YarnRequirement. */
export function hatYarnFabricAreaSquareInches(calc: HatPatternCalc): number {
  const circ = hatKnittedFinishedCircumferenceInches(calc);
  if (!(circ > 0)) return 0;
  const { totalInches } = hatYarnFabricHeightsInches(calc);
  if (!(totalInches > 0)) return 0;
  return circ * totalInches;
}

export type HatYarnEstimationSnapshot = {
  finishedCircumferenceInches: number;
  finishedLengthInches: number;
  brimType: HatPatternCalc["brimType"];
  visibleBrimDepthInches: number;
  knittedBrimDepthInches: number;
  fabricAreaSquareInches: number;
  crownEquivalentHeightInches: number;
};

/** Snapshot of finished dimensions + fabric area from a completed hat calc. */
export function buildHatYarnEstimationSnapshot(calc: HatPatternCalc): HatYarnEstimationSnapshot {
  const heights = hatYarnFabricHeightsInches(calc);
  return {
    finishedCircumferenceInches: hatKnittedFinishedCircumferenceInches(calc),
    finishedLengthInches: calc.hatHeight,
    brimType: calc.brimType,
    visibleBrimDepthInches: calc.brimDepth,
    knittedBrimDepthInches: heights.brimInches,
    fabricAreaSquareInches: hatYarnFabricAreaSquareInches(calc),
    crownEquivalentHeightInches: heights.crownInches,
  };
}

/** Payload for `kbm:yarnDimensions` from a hat pattern calc. */
export function buildHatYarnDimensionsDetail(
  calc: HatPatternCalc,
  lengthUnit: YarnDimensionsLengthUnit = "in",
): YarnDimensionsDetail {
  const circIn = hatKnittedFinishedCircumferenceInches(calc);
  const lenIn = calc.hatHeight;
  const areaIn = hatYarnFabricAreaSquareInches(calc);

  if (lengthUnit === "cm") {
    return {
      projectWidth: circIn * 2.54,
      projectLength: lenIn * 2.54,
      lengthUnit: "cm",
      source: "custom",
      projectAreaSquareInches: areaIn,
    };
  }

  return {
    projectWidth: circIn,
    projectLength: lenIn,
    lengthUnit: "in",
    source: "custom",
    projectAreaSquareInches: areaIn,
  };
}

export function dispatchHatYarnDimensions(
  calc: HatPatternCalc,
  lengthUnit: YarnDimensionsLengthUnit = "in",
): YarnDimensionsDetail {
  const detail = buildHatYarnDimensionsDetail(calc, lengthUnit);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kbm:yarnDimensions", { detail }));
  }
  return detail;
}
