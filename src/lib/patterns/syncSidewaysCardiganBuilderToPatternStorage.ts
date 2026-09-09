/**
 * Persist Sideways Cardigan Express builder choices into canonical pattern storage.
 * Does not call Drop Shoulder / Sleeveless wizard clients.
 */

import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { seedCustomBuildBodyFinishedFromChartRow } from "./sleevelessCustomBuildBodyMeasurements";
import { persistMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { resolveExpressAvailableNeedles } from "./sleevelessExpressAvailableNeedles";
import { rawSwatchToPerInch } from "./syncExpressWizardToPatternStorage";
import {
  parseSidewaysCardiganSleeveDirection,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT,
  withSidewaysCardiganConstructionAuthored,
  type SidewaysCardiganSleeveDirection,
} from "./sidewaysCardiganConstructionIdentity";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";
import {
  parsePositiveInchesField,
  type SidewaysCardiganStyleMeasurements,
} from "./sidewaysCardiganStyleMeasurements";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function formatOverride(n: number | undefined): string | undefined {
  if (n === undefined || !(n > 0)) return undefined;
  return formatSwatchCountForGaugeInput(roundQuarter(n));
}

export type SidewaysCardiganBuilderValues = {
  selectedSize: string;
  chartAudience: "misses" | "plus";
  fit: string;
  vNeckDepthInches?: string;
  styleMeasurements?: Partial<SidewaysCardiganStyleMeasurements>;
  gaugeStitchRaw: string;
  gaugeRowRaw: string;
  availableNeedles: string;
  unit: "in" | "cm";
  sleeveDirection?: SidewaysCardiganSleeveDirection;
};

export function syncSidewaysCardiganBuilderToPatternStorage(
  values: SidewaysCardiganBuilderValues,
  chartRow: SidewaysCardiganWomenChartRow,
): void {
  const fitPreference = values.fit.trim() || "standard";
  const selectedMeasurements = computeDefaultMeasurementsFromChartRow(chartRow, fitPreference, {
    bodyShape: "straight",
  });
  const style = values.styleMeasurements ?? {};
  const finishedLength = parsePositiveInchesField(style.finishedLength);
  const vNeckFromStyle = parsePositiveInchesField(style.vNeckDepth);
  const vNeckFromLegacy = parsePositiveInchesField(values.vNeckDepthInches);
  const vNeckInches = vNeckFromStyle ?? vNeckFromLegacy ?? selectedMeasurements.front_neck_depth;
  const neckOpening = parsePositiveInchesField(style.neckOpeningWidth);
  const finishedUpperArm = parsePositiveInchesField(style.finishedUpperArm);
  const sleeveLength = parsePositiveInchesField(style.sleeveLength);
  const wrist = parsePositiveInchesField(style.wrist);

  const sleeveDirection =
    parseSidewaysCardiganSleeveDirection(values.sleeveDirection) ??
    SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT;

  const authoredStyle = withSidewaysCardiganConstructionAuthored(
    {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
      recipientCategory: values.chartAudience,
    },
    sleeveDirection,
  );

  const prevOverrides = section(section(getCurrentPattern().fit).cbMeasurementOverrides);
  const overrides: Record<string, string> = { ...prevOverrides };
  const lengthOverride = formatOverride(finishedLength);
  if (lengthOverride) overrides.finishedLength = lengthOverride;
  if (typeof vNeckInches === "number" && vNeckInches > 0) {
    overrides.neckDepth = formatSwatchCountForGaugeInput(roundQuarter(vNeckInches));
  }
  const neckOverride = formatOverride(neckOpening);
  if (neckOverride) overrides.finishedNeckOpeningWidth = neckOverride;
  const upperArmOverride = formatOverride(finishedUpperArm);
  if (upperArmOverride) overrides.upperArm = upperArmOverride;
  const sleeveOverride = formatOverride(sleeveLength);
  if (sleeveOverride) overrides.sleeveLength = sleeveOverride;
  const wristOverride = formatOverride(wrist);
  if (wristOverride) overrides.wrist = wristOverride;
  persistMeasurementOverrides(overrides);

  const fitPayload: Record<string, unknown> = {
    sizingChart: values.chartAudience,
    selectedSize: values.selectedSize.trim(),
    easeChoice: fitPreference,
    fitChoice: fitPreference,
    selectedMeasurements: {
      ...selectedMeasurements,
      ...(finishedLength !== undefined ? { back_neck_to_hem: roundQuarter(finishedLength) } : {}),
      ...(typeof vNeckInches === "number" && vNeckInches > 0
        ? { front_neck_depth: roundQuarter(vNeckInches) }
        : {}),
      ...(neckOpening !== undefined ? { neck_width: roundQuarter(neckOpening) } : {}),
      ...(sleeveLength !== undefined ? { sleeve_length: roundQuarter(sleeveLength) } : {}),
    },
    cbMeasurementOverrides: overrides,
  };

  const hasBothGauge =
    Number(values.gaugeStitchRaw) > 0 && Number(values.gaugeRowRaw) > 0;
  const { gaugeStitchesPerInch, gaugeRowsPerInch } = hasBothGauge
    ? rawSwatchToPerInch(values.gaugeStitchRaw, values.gaugeRowRaw, values.unit)
    : { gaugeStitchesPerInch: "", gaugeRowsPerInch: "" };

  const prevMachine = section(getPatternData().yarnGaugeMachine);
  const resolvedNeedles = resolveExpressAvailableNeedles(
    prevMachine,
    values.availableNeedles,
  );

  const yarnGaugeCanonical: Record<string, unknown> = {};
  if (hasBothGauge) {
    yarnGaugeCanonical.stitchGauge = gaugeStitchesPerInch;
    yarnGaugeCanonical.rowGauge = gaugeRowsPerInch;
    yarnGaugeCanonical.gaugeUnits = "per_inch";
    yarnGaugeCanonical.gaugeStitchRaw = values.gaugeStitchRaw;
    yarnGaugeCanonical.gaugeRowRaw = values.gaugeRowRaw;
    yarnGaugeCanonical.gaugeRawUnit = values.unit;
  }

  saveCurrentPattern({
    style: authoredStyle,
    fit: fitPayload,
    ...(Object.keys(yarnGaugeCanonical).length > 0 ? { yarnGauge: yarnGaugeCanonical } : {}),
    machine: {
      ...section(getCurrentPattern().machine),
      availableNeedles: resolvedNeedles,
    },
  });
  savePatternData("style", authoredStyle);
  savePatternData("fit", fitPayload);
  if (Object.keys(yarnGaugeCanonical).length > 0) {
    savePatternData("yarnGauge", yarnGaugeCanonical);
  }
  savePatternData("machine", {
    ...section(getPatternData().machine),
    availableNeedles: resolvedNeedles,
  });
  savePatternData("yarnGaugeMachine", {
    ...prevMachine,
    yarnNotes: "",
    yarnWeight: "",
    availableNeedles: resolvedNeedles,
    gaugeStitchRaw: values.gaugeStitchRaw,
    gaugeRowRaw: values.gaugeRowRaw,
    gaugeRawUnit: values.unit,
    gaugeStitchesPerInch,
    gaugeRowsPerInch,
  });

  seedCustomBuildBodyFinishedFromChartRow(chartRow, fitPreference, {
    preserveFinished: true,
    bodyShape: "straight",
  });
}
