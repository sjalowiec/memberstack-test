/**
 * Temporary visual-review fixtures for the generated Front Stitches & Rows SVG.
 * Same pattern data as the renderer tests — no new pattern math.
 */

import { buildSleevelessFrontStsRowsDiagramModel } from "./sleevelessFrontStsRowsDiagramModel";
import { tryBuildSleevelessFrontStsRowsDiagramSvg } from "./sleevelessFrontStsRowsDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

export type SleevelessFrontStsRowsPreviewCase = {
  id: string;
  title: string;
  summary: string;
  svg: string | null;
  values: Record<string, string | number | boolean>;
};

/** Shared misses body used by the same-garment-size V-neck comparison set. */
export const SAME_SIZE_V_NECK_COMPARISON_MEASUREMENTS = {
  finished_bust_chest: 39,
  back_neck_to_hem: 18,
  armhole_depth: 8,
  neck_opening: 6,
  shoulder_width: 12,
  back_neck_depth: 1,
} as const;

export const SAME_SIZE_V_NECK_COMPARISON_DEPTHS = {
  shallow: 3,
  overlap: 6.86,
  deepBeforeArmhole: 10,
} as const;

export function sameSizeVNeckComparisonPattern(frontNeckDepth: number): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        ...SAME_SIZE_V_NECK_COMPARISON_MEASUREMENTS,
        front_neck_depth: frontNeckDepth,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function shallowVNeckPattern(): Record<string, unknown> {
  return sameSizeVNeckComparisonPattern(SAME_SIZE_V_NECK_COMPARISON_DEPTHS.shallow);
}

function amandaVNeckPattern(): Record<string, unknown> {
  return sameSizeVNeckComparisonPattern(SAME_SIZE_V_NECK_COMPARISON_DEPTHS.overlap);
}

function deepVNeckBeforeArmholePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 11,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function buildCase(
  id: string,
  title: string,
  summary: string,
  patternData: Record<string, unknown>,
): SleevelessFrontStsRowsPreviewCase {
  const result = generateSleevelessBackPattern(patternData);
  const model = buildSleevelessFrontStsRowsDiagramModel(result, patternData);
  const svg = tryBuildSleevelessFrontStsRowsDiagramSvg(model);
  return {
    id,
    title,
    summary,
    svg,
    values: {
      bustStitches: model?.widths.bustStitches ?? "",
      hemStitches: model?.widths.hemStitches ?? "",
      necklineStitches: model?.widths.necklineStitches ?? "",
      stitchesAfterArmhole: model?.widths.stitchesAfterArmhole ?? "",
      shoulderStitchesPerSide: model?.widths.shoulderStitchesPerSide ?? "",
      hemRows: model?.rows.hemRows ?? "",
      sideSeamRows: model?.rows.sideSeamRowsAboveHem ?? "",
      armholeRows: model?.rows.armholeRows ?? "",
      neckDepthRows: model?.neckline.depthRows ?? "",
      totalRows: model?.rows.expectedGarmentRows ?? "",
      armholeStartRc: model?.armhole.startGarmentRc ?? "",
      lastArmholeRc: model?.armhole.lastGarmentRc ?? "",
      armholeStitchesEachSide: model?.armhole.stitchesEachSide ?? "",
      armholeBindOffStsEachSide: model?.armhole.bindOffStsEachSide ?? "",
      armholeDecreaseStsEachSide: model?.armhole.decreaseStsEachSide ?? "",
      neckStartRc: model?.neckline.startGarmentRc ?? "",
      shoulderStartRc: model?.shoulder.startGarmentRc ?? "",
      beginsBeforeArmhole: model?.neckline.beginsBeforeArmhole ?? false,
      overlapsNeckline: model?.armhole.overlapsNeckline ?? false,
    },
  };
}

/**
 * Same misses garment; only V-neck depth and neckline start row change.
 * Use to confirm the V shape moves without changing upper-body width.
 */
export function buildSleevelessFrontStsRowsSameSizeVNeckComparisonCases(): SleevelessFrontStsRowsPreviewCase[] {
  return [
    buildCase(
      "same-size-shallow-v",
      "Same size · Shallow V",
      "Misses 39\" · 3\" front neck · starts after armhole",
      sameSizeVNeckComparisonPattern(SAME_SIZE_V_NECK_COMPARISON_DEPTHS.shallow),
    ),
    buildCase(
      "same-size-overlap-v",
      "Same size · Overlap V",
      "Misses 39\" · 6.86\" front neck · armhole / neck overlap",
      sameSizeVNeckComparisonPattern(SAME_SIZE_V_NECK_COMPARISON_DEPTHS.overlap),
    ),
    buildCase(
      "same-size-deep-v",
      "Same size · Deep V",
      "Misses 39\" · 10\" front neck · V starts before armhole",
      sameSizeVNeckComparisonPattern(SAME_SIZE_V_NECK_COMPARISON_DEPTHS.deepBeforeArmhole),
    ),
  ];
}

/** Shallow V, Amanda (normal / overlap), deep V before armhole. */
export function buildSleevelessFrontStsRowsPreviewCases(): SleevelessFrontStsRowsPreviewCase[] {
  return [
    buildCase(
      "shallow-v",
      "Shallow V",
      "Misses · 3\" front neck · starts after armhole",
      shallowVNeckPattern(),
    ),
    buildCase(
      "normal-v",
      "Normal V",
      "Amanda · 6.86\" front neck · armhole / neck overlap",
      amandaVNeckPattern(),
    ),
    buildCase(
      "deep-v-overlap",
      "Deep V / overlap",
      "Mens · 11\" front neck · V starts before armhole",
      deepVNeckBeforeArmholePattern(),
    ),
  ];
}
