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
  withSidewaysCardiganConstructionAuthored,
  type SidewaysCardiganSleeveDirection,
} from "./sidewaysCardiganConstructionIdentity";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

export type SidewaysCardiganBuilderValues = {
  selectedSize: string;
  chartAudience: "misses" | "plus";
  fit: string;
  vNeckDepthInches: string;
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
  const vNeck = parseFloat(String(values.vNeckDepthInches).replace(/[^\d.-]/g, ""));
  const vNeckInches =
    Number.isFinite(vNeck) && vNeck > 0
      ? roundQuarter(vNeck)
      : selectedMeasurements.front_neck_depth;

  const style = withSidewaysCardiganConstructionAuthored(
    {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
      recipientCategory: values.chartAudience,
    },
    values.sleeveDirection,
  );

  const prevOverrides = section(section(getCurrentPattern().fit).cbMeasurementOverrides);
  const overrides: Record<string, string> = { ...prevOverrides };
  if (typeof vNeckInches === "number" && vNeckInches > 0) {
    overrides.neckDepth = formatSwatchCountForGaugeInput(vNeckInches);
  }
  persistMeasurementOverrides(overrides);

  const fitPayload: Record<string, unknown> = {
    sizingChart: values.chartAudience,
    selectedSize: values.selectedSize.trim(),
    easeChoice: fitPreference,
    fitChoice: fitPreference,
    selectedMeasurements: {
      ...selectedMeasurements,
      ...(typeof vNeckInches === "number" && vNeckInches > 0
        ? { front_neck_depth: vNeckInches }
        : {}),
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
    style,
    fit: fitPayload,
    ...(Object.keys(yarnGaugeCanonical).length > 0 ? { yarnGauge: yarnGaugeCanonical } : {}),
    machine: {
      ...section(getCurrentPattern().machine),
      availableNeedles: resolvedNeedles,
    },
  });
  savePatternData("style", style);
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
