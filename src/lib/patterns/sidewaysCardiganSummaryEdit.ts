/**
 * Sideways V-Neck Summary/Edit — reuse sweater override storage and the shared
 * PatternSummaryEditWorkspace chips. Does not change Cardigan/Pullover or sleeve direction.
 */

import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import type { PatternSummaryMeasurementField } from "./patternSummaryMeasurementField";
import { getCurrentPattern, getPatternData, saveCurrentPattern, savePatternData } from "./patternStorage";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "./sleevelessCustomMeasurementStorage";
import {
  readSidewaysCardiganBuilderStateFromDraft,
  type SidewaysCardiganBuilderDraftState,
} from "./sidewaysCardiganBuilderState";
import {
  parsePositiveInchesField,
  SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS,
  type SidewaysCardiganStyleMeasurementKey,
  type SidewaysCardiganStyleMeasurements,
} from "./sidewaysCardiganStyleMeasurements";

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS: Record<
  SidewaysCardiganStyleMeasurementKey,
  string
> = {
  finishedLength: "finishedLength",
  vNeckDepth: "neckDepth",
  neckOpeningWidth: "finishedNeckOpeningWidth",
  finishedUpperArm: "upperArm",
  sleeveLength: "sleeveLength",
  wrist: "wrist",
};

const SELECTED_MEASUREMENT_KEYS: Partial<Record<SidewaysCardiganStyleMeasurementKey, string>> = {
  finishedLength: "back_neck_to_hem",
  vNeckDepth: "front_neck_depth",
  neckOpeningWidth: "neck_width",
  sleeveLength: "sleeve_length",
};

const MEASURE_INPUT = {
  inputType: "number" as const,
  inputMode: "decimal",
  step: "0.25",
  min: "1",
  editable: true,
};

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...MEASURE_INPUT,
    id: "finishedLength",
    label: "Finished garment length",
    targetId: "sideways-finished-length",
    inputId: "sideways-edit-finished-length",
    inputDataAttr: "data-sideways-edit-finished-length",
    testId: "sideways-edit-chip-finished-length",
    inputTestId: "sideways-edit-finished-length",
  },
  {
    ...MEASURE_INPUT,
    id: "vNeckDepth",
    label: "V-neck depth",
    targetId: "sideways-vneck-depth",
    inputId: "sideways-edit-vneck-depth",
    inputDataAttr: "data-sideways-edit-vneck-depth",
    testId: "sideways-edit-chip-vneck-depth",
    inputTestId: "sideways-edit-vneck-depth",
  },
  {
    ...MEASURE_INPUT,
    id: "neckOpeningWidth",
    label: "Neck-opening width",
    targetId: "sideways-neck-opening",
    inputId: "sideways-edit-neck-opening",
    inputDataAttr: "data-sideways-edit-neck-opening",
    testId: "sideways-edit-chip-neck-opening",
    inputTestId: "sideways-edit-neck-opening",
  },
  {
    ...MEASURE_INPUT,
    id: "finishedUpperArm",
    label: "Finished upper arm",
    targetId: "sideways-finished-upper-arm",
    inputId: "sideways-edit-finished-upper-arm",
    inputDataAttr: "data-sideways-edit-finished-upper-arm",
    testId: "sideways-edit-chip-finished-upper-arm",
    inputTestId: "sideways-edit-finished-upper-arm",
  },
  {
    ...MEASURE_INPUT,
    id: "sleeveLength",
    label: "Sleeve length",
    targetId: "sideways-sleeve-length",
    inputId: "sideways-edit-sleeve-length",
    inputDataAttr: "data-sideways-edit-sleeve-length",
    testId: "sideways-edit-chip-sleeve-length",
    inputTestId: "sideways-edit-sleeve-length",
  },
  {
    ...MEASURE_INPUT,
    id: "wrist",
    label: "Wrist",
    targetId: "sideways-wrist",
    inputId: "sideways-edit-wrist",
    inputDataAttr: "data-sideways-edit-wrist",
    testId: "sideways-edit-chip-wrist",
    inputTestId: "sideways-edit-wrist",
  },
];

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

export function mergeSidewaysCardiganSummaryMeasurements(
  current: SidewaysCardiganStyleMeasurements,
  edits: Partial<SidewaysCardiganStyleMeasurements>,
): SidewaysCardiganStyleMeasurements {
  const next = { ...current };
  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    const raw = edits[key];
    if (raw === undefined) continue;
    next[key] = String(raw).trim();
  }
  return next;
}

export function applySidewaysCardiganSummaryMeasurementEdits(
  edits: Partial<SidewaysCardiganStyleMeasurements>,
  state: SidewaysCardiganBuilderDraftState = readSidewaysCardiganBuilderStateFromDraft(),
): { ok: true; state: SidewaysCardiganBuilderDraftState } | { ok: false; message: string } {
  const styleMeasurements = mergeSidewaysCardiganSummaryMeasurements(state.styleMeasurements, edits);
  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    if (parsePositiveInchesField(styleMeasurements[key]) === undefined) {
      return { ok: false, message: "Enter a positive value for every measurement." };
    }
  }

  const overrides: Record<string, string> = { ...loadMeasurementOverrides() };
  const selectedPatch: Record<string, number> = {};
  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    const inches = parsePositiveInchesField(styleMeasurements[key]);
    if (inches === undefined) continue;
    const rounded = roundQuarter(inches);
    overrides[SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS[key]] =
      formatSwatchCountForGaugeInput(rounded);
    const selectedKey = SELECTED_MEASUREMENT_KEYS[key];
    if (selectedKey) selectedPatch[selectedKey] = rounded;
  }
  persistMeasurementOverrides(overrides);

  const prevFit = {
    ...section(getCurrentPattern().fit),
    ...section(getPatternData().fit),
  };
  const fitPayload = {
    ...prevFit,
    selectedMeasurements: {
      ...section(prevFit.selectedMeasurements),
      ...selectedPatch,
    },
    cbMeasurementOverrides: overrides,
  };
  saveCurrentPattern({ fit: fitPayload });
  savePatternData("fit", fitPayload);

  const next: SidewaysCardiganBuilderDraftState = {
    ...state,
    styleMeasurements,
    userEditedStyle: {
      ...state.userEditedStyle,
      ...Object.fromEntries(
        SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS.filter((key) => edits[key] !== undefined).map(
          (key) => [key, true as const],
        ),
      ),
    },
  };
  return { ok: true, state: next };
}
