/**
 * Chart + ease → Sideways Cardigan style-measurement defaults and size-change reseeding.
 * User-edited fields are preserved when size or fit changes.
 */

import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  finishedUpperArmInchesForSidewaysCardigan,
} from "./sidewaysCardiganFinishedMeasurements";
import { resolveDropShoulderFinishedWristInches } from "./dropShoulderSleeveEase";
import type { SidewaysCardiganWomenChartAudience } from "./sidewaysCardiganSizeCharts";

export const SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS = [
  "finishedLength",
  "vNeckDepth",
  "neckOpeningWidth",
  "finishedUpperArm",
  "sleeveLength",
  "wrist",
] as const;

export type SidewaysCardiganStyleMeasurementKey =
  (typeof SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS)[number];

export type SidewaysCardiganStyleMeasurements = Record<
  SidewaysCardiganStyleMeasurementKey,
  string
>;

export type SidewaysCardiganUserEditedStyle = Partial<
  Record<SidewaysCardiganStyleMeasurementKey, true>
>;

function emptyStyleMeasurements(): SidewaysCardiganStyleMeasurements {
  return {
    finishedLength: "",
    vNeckDepth: "",
    neckOpeningWidth: "",
    finishedUpperArm: "",
    sleeveLength: "",
    wrist: "",
  };
}

function formatInchesField(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n) || n <= 0) return "";
  return formatSwatchCountForGaugeInput(n);
}

export function finishedBustInchesFromChartRow(
  row: ChartRow,
  fitPreference: string,
): number | undefined {
  const selected = computeDefaultMeasurementsFromChartRow(row, fitPreference, {
    bodyShape: "straight",
  });
  const n = selected.finished_bust_chest;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function defaultSidewaysCardiganStyleMeasurements(args: {
  row: ChartRow;
  chartAudience: SidewaysCardiganWomenChartAudience;
  fitPreference: string;
}): SidewaysCardiganStyleMeasurements {
  const selected = computeDefaultMeasurementsFromChartRow(args.row, args.fitPreference, {
    bodyShape: "straight",
  });
  const finishedUpperArm = finishedUpperArmInchesForSidewaysCardigan({
    chartAudience: args.chartAudience,
    fitPreference: args.fitPreference,
    bodyUpperArmIn: selected.upper_arm,
  });
  const finishedWrist = resolveDropShoulderFinishedWristInches({
    chartAudience: args.chartAudience,
    fit: args.fitPreference,
    bodyWristIn: selected.wrist,
  });
  return {
    finishedLength: formatInchesField(selected.back_neck_to_hem),
    vNeckDepth: formatInchesField(selected.front_neck_depth),
    neckOpeningWidth: formatInchesField(selected.neck_width),
    finishedUpperArm: formatInchesField(finishedUpperArm),
    sleeveLength: formatInchesField(selected.sleeve_length),
    wrist: formatInchesField(finishedWrist ?? selected.wrist),
  };
}

/** Apply a new chart row / fit: refresh fields the knitter has not edited. */
export function reseedSidewaysCardiganStyleMeasurements(args: {
  previous: SidewaysCardiganStyleMeasurements;
  userEdited: SidewaysCardiganUserEditedStyle;
  row: ChartRow;
  chartAudience: SidewaysCardiganWomenChartAudience;
  fitPreference: string;
}): SidewaysCardiganStyleMeasurements {
  const defaults = defaultSidewaysCardiganStyleMeasurements(args);
  const next = { ...args.previous };
  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    if (!args.userEdited[key]) next[key] = defaults[key];
  }
  return next;
}

export function parsePositiveInchesField(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function styleMeasurementsAreComplete(
  measurements: SidewaysCardiganStyleMeasurements,
): boolean {
  return SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS.every(
    (key) => parsePositiveInchesField(measurements[key]) !== undefined,
  );
}

export function emptySidewaysCardiganStyleMeasurements(): SidewaysCardiganStyleMeasurements {
  return emptyStyleMeasurements();
}
