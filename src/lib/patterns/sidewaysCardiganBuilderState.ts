/**
 * Builder edit-state restored from the working draft (Back to builder).
 */

import { getCurrentPattern, getPatternData } from "./patternStorage";
import {
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
} from "./sleevelessExpressAvailableNeedles";
import {
  EXPRESS_GAUGE_ROW_INPUT_ID,
  EXPRESS_GAUGE_STITCH_INPUT_ID,
} from "./expressBuilderReviewSubmit";
import {
  parseSidewaysCardiganSleeveDirection,
  parseSidewaysCardiganSleeveLengthChoice,
  resolveSidewaysCardiganGarmentStyle,
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_DEFAULT,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveDirection,
  type SidewaysCardiganSleeveLengthChoice,
} from "./sidewaysCardiganConstructionIdentity";
import {
  emptySidewaysCardiganStyleMeasurements,
  type SidewaysCardiganStyleMeasurements,
  type SidewaysCardiganUserEditedStyle,
} from "./sidewaysCardiganStyleMeasurements";
import type { SidewaysCardiganWomenChartAudience } from "./sidewaysCardiganSizeCharts";

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

function stringField(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export type SidewaysCardiganBuilderDraftState = {
  garmentStyle: SidewaysCardiganGarmentStyle;
  chartAudience: SidewaysCardiganWomenChartAudience | "";
  selectedSize: string;
  fit: string;
  sleeveDirection: SidewaysCardiganSleeveDirection;
  sleeveLengthChoice: SidewaysCardiganSleeveLengthChoice;
  styleMeasurements: SidewaysCardiganStyleMeasurements;
  userEditedStyle: SidewaysCardiganUserEditedStyle;
  gaugeStitchRaw: string;
  gaugeRowRaw: string;
  availableNeedles: string;
  unit: "in" | "cm";
};

export function emptySidewaysCardiganBuilderDraftState(): SidewaysCardiganBuilderDraftState {
  return {
    garmentStyle: SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT,
    chartAudience: "",
    selectedSize: "",
    fit: "",
    sleeveDirection: SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT,
    sleeveLengthChoice: SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_DEFAULT,
    styleMeasurements: emptySidewaysCardiganStyleMeasurements(),
    userEditedStyle: {},
    gaugeStitchRaw: "",
    gaugeRowRaw: "",
    availableNeedles: "",
    unit: "in",
  };
}

export function readSidewaysCardiganStyleMeasurementsFromDraft(
  pattern: Record<string, unknown> = getCurrentPattern() as unknown as Record<string, unknown>,
): {
  measurements: SidewaysCardiganStyleMeasurements;
  edited: SidewaysCardiganUserEditedStyle;
} {
  const fit = section(pattern.fit);
  const sm = section(fit.selectedMeasurements);
  const overrides = section(fit.cbMeasurementOverrides);
  const measurements = emptySidewaysCardiganStyleMeasurements();
  measurements.finishedLength = stringField(overrides.finishedLength ?? sm.back_neck_to_hem);
  measurements.vNeckDepth = stringField(overrides.neckDepth ?? sm.front_neck_depth);
  measurements.neckOpeningWidth = stringField(
    overrides.finishedNeckOpeningWidth ?? sm.neck_width,
  );
  measurements.finishedUpperArm = stringField(overrides.upperArm);
  measurements.sleeveLength = stringField(overrides.sleeveLength ?? sm.sleeve_length);
  measurements.wrist = stringField(overrides.wrist ?? sm.wrist);
  return { measurements, edited: {} };
}

/** Same restore the builder uses when returning from the workspace. */
export function readSidewaysCardiganBuilderStateFromDraft(
  pattern: Record<string, unknown> = {
    ...(getCurrentPattern() as unknown as Record<string, unknown>),
    ...getPatternData(),
    style: {
      ...section(getCurrentPattern().style),
      ...section(getPatternData().style),
    },
    fit: {
      ...section(getCurrentPattern().fit),
      ...section(getPatternData().fit),
    },
    yarnGauge: {
      ...section(getCurrentPattern().yarnGauge),
      ...section(getPatternData().yarnGauge),
    },
    yarnGaugeMachine: section(getPatternData().yarnGaugeMachine),
    machine: {
      ...section(getCurrentPattern().machine),
      ...section(getPatternData().machine),
    },
  },
): SidewaysCardiganBuilderDraftState {
  const fit = section(pattern.fit);
  const style = section(pattern.style);
  const yg = section(pattern.yarnGauge);
  const ygm = section(pattern.yarnGaugeMachine);
  const machine = section(pattern.machine);
  const selectedSize = stringField(fit.selectedSize);
  const ease = stringField(fit.easeChoice ?? fit.fitChoice);
  const audienceRaw = stringField(style.recipientCategory ?? fit.sizingChart).toLowerCase();
  const chartAudience: SidewaysCardiganWomenChartAudience | "" =
    audienceRaw === "plus" || audienceRaw === "misses" ? audienceRaw : "";
  const { measurements, edited } = readSidewaysCardiganStyleMeasurementsFromDraft(pattern);
  const unitRaw = stringField(yg.gaugeRawUnit ?? ygm.gaugeRawUnit);
  return {
    garmentStyle: resolveSidewaysCardiganGarmentStyle(style),
    chartAudience,
    selectedSize,
    fit: ease === "close" || ease === "relaxed" || ease === "standard" ? ease : "",
    sleeveDirection:
      parseSidewaysCardiganSleeveDirection(style.sleeveDirection) ??
      SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_DEFAULT,
    sleeveLengthChoice: parseSidewaysCardiganSleeveLengthChoice(style.sleeveLength),
    styleMeasurements: measurements,
    userEditedStyle: edited,
    gaugeStitchRaw: stringField(yg.gaugeStitchRaw ?? ygm.gaugeStitchRaw),
    gaugeRowRaw: stringField(yg.gaugeRowRaw ?? ygm.gaugeRowRaw),
    availableNeedles: stringField(
      ygm.availableNeedles ?? machine.availableNeedles,
    ),
    unit: unitRaw === "cm" ? "cm" : "in",
  };
}

export function applySidewaysCardiganDraftToGaugeInputs(
  state: SidewaysCardiganBuilderDraftState,
  doc: Document = document,
): void {
  const st = doc.getElementById(EXPRESS_GAUGE_STITCH_INPUT_ID);
  const rw = doc.getElementById(EXPRESS_GAUGE_ROW_INPUT_ID);
  const nd = doc.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID);
  if (st instanceof HTMLInputElement && state.gaugeStitchRaw) st.value = state.gaugeStitchRaw;
  if (rw instanceof HTMLInputElement && state.gaugeRowRaw) rw.value = state.gaugeRowRaw;
  if (nd instanceof HTMLInputElement && state.availableNeedles) nd.value = state.availableNeedles;
}
