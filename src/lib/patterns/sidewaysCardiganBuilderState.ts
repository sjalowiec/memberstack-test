/**
 * Builder edit-state restored from the working draft (Back to builder).
 */

import { getCurrentPattern, getPatternData, saveCurrentPattern, savePatternData } from "./patternStorage";
import {
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
} from "./sleevelessExpressAvailableNeedles";
import {
  EXPRESS_GAUGE_ROW_INPUT_ID,
  EXPRESS_GAUGE_STITCH_INPUT_ID,
} from "./expressBuilderReviewSubmit";
import {
  parseSidewaysCardiganSleeveDirection,
  readSavedSidewaysCardiganSleeveLengthChoice,
  resolveSidewaysCardiganBuilderSleeveSelections,
  resolveSidewaysCardiganGarmentStyle,
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT,
  writeSidewaysCardiganWorkingDraftStamp,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveDirection,
  type SidewaysCardiganSleeveLengthChoice,
} from "./sidewaysCardiganConstructionIdentity";
import {
  emptySidewaysCardiganStyleMeasurements,
  type SidewaysCardiganStyleMeasurements,
  type SidewaysCardiganUserEditedStyle,
} from "./sidewaysCardiganStyleMeasurements";
import {
  isSidewaysCardiganSizeInChart,
  parseSidewaysCardiganChartAudience,
  resolveSidewaysCardiganChartAudienceFromSize,
  type SidewaysCardiganChartAudience,
} from "./sidewaysCardiganSizeCharts";

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
  chartAudience: SidewaysCardiganChartAudience | "";
  selectedSize: string;
  fit: string;
  sleeveDirection: SidewaysCardiganSleeveDirection | "";
  sleeveLengthChoice: SidewaysCardiganSleeveLengthChoice | "";
  styleMeasurements: SidewaysCardiganStyleMeasurements;
  userEditedStyle: SidewaysCardiganUserEditedStyle;
  gaugeStitchRaw: string;
  gaugeRowRaw: string;
  availableNeedles: string;
  unit: "in" | "cm";
};

/** Stamp + read used when a new Sideways builder session opens (no page DOM required). */
export function initializeFreshSidewaysCardiganBuilderState(): SidewaysCardiganBuilderDraftState {
  writeSidewaysCardiganWorkingDraftStamp();
  return readSidewaysCardiganBuilderStateFromDraft();
}

export function emptySidewaysCardiganBuilderDraftState(): SidewaysCardiganBuilderDraftState {
  return {
    garmentStyle: SIDEWAYS_CARDIGAN_GARMENT_STYLE_DEFAULT,
    chartAudience: "",
    selectedSize: "",
    fit: "",
    sleeveDirection: "",
    sleeveLengthChoice: "",
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
  const audienceRaw = stringField(style.recipientCategory ?? fit.sizingChart);
  let chartAudience: SidewaysCardiganChartAudience | "" =
    parseSidewaysCardiganChartAudience(audienceRaw) ?? "";
  if (!chartAudience && selectedSize) {
    chartAudience = resolveSidewaysCardiganChartAudienceFromSize(selectedSize) ?? "";
  }
  const { measurements, edited } = readSidewaysCardiganStyleMeasurementsFromDraft(pattern);
  const unitRaw = stringField(yg.gaugeRawUnit ?? ygm.gaugeRawUnit);
  const sleeveSelections = resolveSidewaysCardiganBuilderSleeveSelections(style);
  return {
    garmentStyle: resolveSidewaysCardiganGarmentStyle(style),
    chartAudience,
    selectedSize,
    fit: ease === "close" || ease === "relaxed" || ease === "standard" ? ease : "",
    sleeveDirection: sleeveSelections.sleeveDirection,
    sleeveLengthChoice: sleeveSelections.sleeveLengthChoice,
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

/**
 * Activate a starting-size chart. Clears an incompatible size so the knitter
 * must pick from the newly selected chart. Women's stays stored as `plus`.
 */
export function applySidewaysCardiganStartingChartSelection(
  state: SidewaysCardiganBuilderDraftState,
  audience: SidewaysCardiganChartAudience,
): void {
  const sizeStillValid = isSidewaysCardiganSizeInChart(state.selectedSize, audience);
  if (state.chartAudience !== audience) {
    state.userEditedStyle = {};
    if (!sizeStillValid) {
      state.selectedSize = "";
      state.styleMeasurements = emptySidewaysCardiganStyleMeasurements();
    }
  }
  state.chartAudience = audience;
}

/** Write chart + size identity without requiring a chart row (cleared size, chart-only pick). */
export function writeSidewaysCardiganSizingIdentity(args: {
  chartAudience: SidewaysCardiganChartAudience | "";
  selectedSize: string;
}): void {
  const current = getCurrentPattern() as unknown as Record<string, unknown>;
  const pb = getPatternData();
  const fit = {
    ...section(current.fit),
    ...section(pb.fit),
    ...(args.chartAudience ? { sizingChart: args.chartAudience } : {}),
    selectedSize: args.selectedSize,
  };
  const style = {
    ...section(current.style),
    ...section(pb.style),
    ...(args.chartAudience ? { recipientCategory: args.chartAudience } : {}),
  };
  saveCurrentPattern({ fit, style });
  savePatternData("fit", fit);
  savePatternData("style", style);
}

export function isSidewaysCardiganSleeveStepComplete(
  state: Pick<SidewaysCardiganBuilderDraftState, "sleeveLengthChoice">,
): boolean {
  return Boolean(readSavedSidewaysCardiganSleeveLengthChoice(state.sleeveLengthChoice));
}

/** Apply one Sleeve picker choice. Length completes the step. Direction is stored when supplied and is not required. */
export function applySidewaysCardiganSleeveChoice(
  state: SidewaysCardiganBuilderDraftState,
  field: "sleeveDirection" | "sleeveLength",
  value: string,
): { complete: boolean; openStep: 4 | 5 } {
  if (field === "sleeveDirection") {
    const dir = parseSidewaysCardiganSleeveDirection(value);
    if (dir) state.sleeveDirection = dir;
  } else {
    const length = readSavedSidewaysCardiganSleeveLengthChoice(value);
    if (length) state.sleeveLengthChoice = length;
  }
  const complete = isSidewaysCardiganSleeveStepComplete(state);
  return { complete, openStep: complete ? 5 : 4 };
}
