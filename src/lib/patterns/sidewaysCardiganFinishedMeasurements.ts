/**
 * Chart + ease → sideways body calc inputs.
 * Reuses existing sweater ease and Drop Shoulder adult sleeve-ease for finished upper arm.
 * Custom-measurement overrides win when present (same resolvers as other sweater builders).
 */

import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import { resolveEffectiveFrontNeckDepthInches } from "./customBuildEffectiveNeckDepth";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { resolveDropShoulderFinishedUpperArmInches } from "./dropShoulderSleeveEase";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganWomenChartAudience } from "./sidewaysCardiganSizeCharts";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function toPositiveNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function finishedUpperArmInchesForSidewaysCardigan(args: {
  chartAudience: SidewaysCardiganWomenChartAudience;
  fitPreference: string;
  bodyUpperArmIn: number | undefined;
  overrideUpperArmIn?: number;
}): number | undefined {
  if (args.overrideUpperArmIn !== undefined && args.overrideUpperArmIn > 0) {
    return args.overrideUpperArmIn;
  }
  return resolveDropShoulderFinishedUpperArmInches({
    chartAudience: args.chartAudience,
    fit: args.fitPreference,
    bodyUpperArmIn: args.bodyUpperArmIn,
  });
}

export function sidewaysCardiganCalcInputFromChartRow(args: {
  row: ChartRow;
  chartAudience: SidewaysCardiganWomenChartAudience;
  fitPreference: string;
  vNeckDepthInches: number;
  stitchesPerInch: number;
  rowsPerInch: number;
}): SidewaysCardiganBodyCalcInput | null {
  const selected = computeDefaultMeasurementsFromChartRow(args.row, args.fitPreference, {
    bodyShape: "straight",
  });
  const finishedBust = selected.finished_bust_chest;
  const garmentLength = selected.back_neck_to_hem;
  const neckOpening = selected.neck_width;
  const bodyUpperArm = selected.upper_arm;
  const finishedUpperArm = finishedUpperArmInchesForSidewaysCardigan({
    chartAudience: args.chartAudience,
    fitPreference: args.fitPreference,
    bodyUpperArmIn: bodyUpperArm,
  });
  if (
    !(finishedBust > 0) ||
    !(garmentLength > 0) ||
    !(neckOpening > 0) ||
    finishedUpperArm === undefined ||
    !(args.vNeckDepthInches > 0) ||
    !(args.stitchesPerInch > 0) ||
    !(args.rowsPerInch > 0)
  ) {
    return null;
  }
  return {
    garmentLengthInches: garmentLength,
    vNeckDepthInches: args.vNeckDepthInches,
    finishedBustCircumferenceInches: finishedBust,
    finishedUpperArmInches: finishedUpperArm,
    neckOpeningWidthInches: neckOpening,
    stitchesPerInch: args.stitchesPerInch,
    rowsPerInch: args.rowsPerInch,
  };
}

/** Resolve calc inputs from a working draft, honoring custom-measurement overrides. */
export function resolveSidewaysCardiganBodyCalcInputFromPattern(
  patternData: Record<string, unknown>,
): SidewaysCardiganBodyCalcInput | null {
  const ygm = section(patternData.yarnGaugeMachine);
  const spi = toPositiveNumber(ygm.gaugeStitchesPerInch);
  const rpi = toPositiveNumber(ygm.gaugeRowsPerInch);
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  const overrides = section(fit.cbMeasurementOverrides);
  const audienceRaw = String(
    section(patternData.style).recipientCategory ?? fit.sizingChart ?? "",
  )
    .trim()
    .toLowerCase();
  const chartAudience: SidewaysCardiganWomenChartAudience | null =
    audienceRaw === "plus" ? "plus" : audienceRaw === "misses" ? "misses" : null;

  const garmentLength = resolveEffectiveFinishedLengthInches(patternData);
  const finishedBust = resolveEffectiveFinishedBustInches(patternData);
  const vNeckDepth = resolveEffectiveFrontNeckDepthInches(patternData);
  const neckOpening = resolveEffectiveNeckOpeningWidthInches(patternData);
  const overrideUpperArm = positiveMeasurementInches(overrides.upperArm);
  const bodyUpperArm = toPositiveNumber(sm.upper_arm);
  const fitPreference = String(fit.easeChoice ?? fit.fitChoice ?? "standard");
  const finishedUpperArm =
    chartAudience == null
      ? overrideUpperArm ?? bodyUpperArm
      : finishedUpperArmInchesForSidewaysCardigan({
          chartAudience,
          fitPreference,
          bodyUpperArmIn: bodyUpperArm,
          overrideUpperArmIn: overrideUpperArm,
        });

  if (
    spi === undefined ||
    rpi === undefined ||
    garmentLength === undefined ||
    finishedBust === undefined ||
    vNeckDepth === undefined ||
    neckOpening === undefined ||
    finishedUpperArm === undefined
  ) {
    return null;
  }

  return {
    garmentLengthInches: garmentLength,
    vNeckDepthInches: vNeckDepth,
    finishedBustCircumferenceInches: finishedBust,
    finishedUpperArmInches: finishedUpperArm,
    neckOpeningWidthInches: neckOpening,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
  };
}
