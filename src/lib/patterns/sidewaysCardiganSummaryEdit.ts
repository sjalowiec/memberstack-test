/**
 * Sideways V-Neck Summary/Edit — reuse sweater override storage and the shared
 * PatternSummaryEditWorkspace chips. Does not change Cardigan/Pullover or sleeve direction.
 */

import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import type { PatternSummaryMeasurementField } from "./patternSummaryMeasurementField";
import {
  formatMeasurementDisplayFromInches,
  parseMeasurementInputToInches,
  parseStoredInchesForDisplay,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";
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
import {
  writeSidewaysCardiganWorkingDraftStamp,
  type SidewaysCardiganGarmentStyle,
} from "./sidewaysCardiganConstructionIdentity";
import {
  SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS,
  type SidewaysCardiganEditMeasurementDiagramInput,
} from "./sidewaysCardiganEditMeasurementDiagramSvg";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { mergeSidewaysCardiganWorkingDraft } from "./sidewaysCardiganWorkspaceLoad";

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS = {
  finishedBust: "chestBust",
  finishedLength: "finishedLength",
  vNeckDepth: "neckDepth",
  neckOpeningWidth: "finishedNeckOpeningWidth",
  finishedUpperArm: "upperArm",
  sleeveLength: "sleeveLength",
  wrist: "wrist",
} as const;

export type SidewaysCardiganSummaryMeasurementKey =
  keyof typeof SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS;

export type SidewaysCardiganSummaryMeasurements = SidewaysCardiganStyleMeasurements & {
  finishedBust: string;
};

const SELECTED_MEASUREMENT_KEYS: Partial<Record<SidewaysCardiganSummaryMeasurementKey, string>> = {
  finishedBust: "finished_bust_chest",
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
  unitSuffixAttr: "data-sideways-edit-unit-suffix",
};

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...MEASURE_INPUT,
    id: "finishedBust",
    label: "Finished bust/chest",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust,
    transform: "translate(calc(-100% - 8px), -50%)",
    inputId: "sideways-edit-finished-bust",
    inputDataAttr: "data-sideways-edit-finished-bust",
    testId: "sideways-edit-chip-finished-bust",
    inputTestId: "sideways-edit-finished-bust",
  },
  {
    ...MEASURE_INPUT,
    id: "finishedLength",
    label: "Finished back length",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedLength,
    transform: "translate(-50%, 8px)",
    inputId: "sideways-edit-finished-length",
    inputDataAttr: "data-sideways-edit-finished-length",
    testId: "sideways-edit-chip-finished-length",
    inputTestId: "sideways-edit-finished-length",
  },
  {
    ...MEASURE_INPUT,
    id: "neckOpeningWidth",
    label: "Neck opening width",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.neckOpeningWidth,
    transform: "translate(8px, -50%)",
    inputId: "sideways-edit-neck-opening",
    inputDataAttr: "data-sideways-edit-neck-opening",
    testId: "sideways-edit-chip-neck-opening",
    inputTestId: "sideways-edit-neck-opening",
  },
  {
    ...MEASURE_INPUT,
    id: "vNeckDepth",
    label: "V-neck depth",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.vNeckDepth,
    transform: "translate(-50%, calc(-100% - 8px))",
    inputId: "sideways-edit-vneck-depth",
    inputDataAttr: "data-sideways-edit-vneck-depth",
    testId: "sideways-edit-chip-vneck-depth",
    inputTestId: "sideways-edit-vneck-depth",
  },
  {
    ...MEASURE_INPUT,
    id: "finishedUpperArm",
    label: "Upper arm",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm,
    transform: "translate(8px, -50%)",
    inputId: "sideways-edit-finished-upper-arm",
    inputDataAttr: "data-sideways-edit-finished-upper-arm",
    testId: "sideways-edit-chip-finished-upper-arm",
    inputTestId: "sideways-edit-finished-upper-arm",
  },
  {
    ...MEASURE_INPUT,
    id: "sleeveLength",
    label: "Sleeve length",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength,
    transform: "translate(-50%, 8px)",
    inputId: "sideways-edit-sleeve-length",
    inputDataAttr: "data-sideways-edit-sleeve-length",
    testId: "sideways-edit-chip-sleeve-length",
    inputTestId: "sideways-edit-sleeve-length",
  },
  {
    ...MEASURE_INPUT,
    id: "wrist",
    label: "Wrist",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist,
    transform: "translate(8px, -50%)",
    inputId: "sideways-edit-wrist",
    inputDataAttr: "data-sideways-edit-wrist",
    testId: "sideways-edit-chip-wrist",
    inputTestId: "sideways-edit-wrist",
  },
];

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS = SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS.map(
  (field) => field.id as SidewaysCardiganSummaryMeasurementKey,
);

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? { ...(obj as Record<string, unknown>) }
    : {};
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function stringField(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export function emptySidewaysCardiganSummaryMeasurements(): SidewaysCardiganSummaryMeasurements {
  return {
    finishedBust: "",
    finishedLength: "",
    vNeckDepth: "",
    neckOpeningWidth: "",
    finishedUpperArm: "",
    sleeveLength: "",
    wrist: "",
  };
}

export function readSidewaysCardiganSummaryMeasurements(
  pattern: Record<string, unknown> = mergeSidewaysCardiganWorkingDraft(),
): SidewaysCardiganSummaryMeasurements {
  const fromDraft = readSidewaysCardiganBuilderStateFromDraft(pattern);
  const fit = section(pattern.fit);
  const sm = section(fit.selectedMeasurements);
  const overrides = section(fit.cbMeasurementOverrides);
  const finishedBust =
    stringField(overrides.chestBust) ||
    stringField(sm.finished_bust_chest) ||
    (resolveEffectiveFinishedBustInches(pattern) !== undefined
      ? formatSwatchCountForGaugeInput(roundQuarter(resolveEffectiveFinishedBustInches(pattern)!))
      : "");
  return {
    ...fromDraft.styleMeasurements,
    finishedBust,
  };
}

export function mergeSidewaysCardiganSummaryMeasurements(
  current: SidewaysCardiganSummaryMeasurements,
  edits: Partial<SidewaysCardiganSummaryMeasurements>,
): SidewaysCardiganSummaryMeasurements {
  const next = { ...current };
  for (const key of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS) {
    const raw = edits[key];
    if (raw === undefined) continue;
    next[key] = String(raw).trim();
  }
  return next;
}

export function summaryMeasurementsToInches(
  measurements: SidewaysCardiganSummaryMeasurements,
  unit: MeasurementDisplayUnit,
): Partial<Record<SidewaysCardiganSummaryMeasurementKey, number>> {
  const inches: Partial<Record<SidewaysCardiganSummaryMeasurementKey, number>> = {};
  for (const key of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS) {
    const parsed = parseMeasurementInputToInches(measurements[key], unit);
    if (parsed !== undefined) inches[key] = parsed;
  }
  return inches;
}

export function displaySidewaysCardiganSummaryMeasurements(
  measurements: SidewaysCardiganSummaryMeasurements,
  unit: MeasurementDisplayUnit,
): SidewaysCardiganSummaryMeasurements {
  const next = emptySidewaysCardiganSummaryMeasurements();
  for (const key of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS) {
    next[key] = formatMeasurementDisplayFromInches(
      parseStoredInchesForDisplay(measurements[key]),
      unit,
    );
  }
  return next;
}

export function applySidewaysCardiganSummaryMeasurementEdits(
  edits: Partial<SidewaysCardiganSummaryMeasurements>,
  state: SidewaysCardiganBuilderDraftState = readSidewaysCardiganBuilderStateFromDraft(),
): { ok: true; state: SidewaysCardiganBuilderDraftState; garmentStyle: SidewaysCardiganGarmentStyle } | { ok: false; message: string } {
  const current = readSidewaysCardiganSummaryMeasurements();
  const styleMeasurements = mergeSidewaysCardiganSummaryMeasurements(current, edits);
  for (const key of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS) {
    if (parsePositiveInchesField(styleMeasurements[key]) === undefined) {
      return { ok: false, message: "Enter a positive value for every measurement." };
    }
  }

  const garmentStyle = state.garmentStyle;
  writeSidewaysCardiganWorkingDraftStamp({
    garmentStyle,
    sleeveDirection: state.sleeveDirection,
    sleeveLength: state.sleeveLengthChoice,
  });

  const overrides: Record<string, string> = { ...loadMeasurementOverrides() };
  const selectedPatch: Record<string, number> = {};
  for (const key of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS) {
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

  writeSidewaysCardiganWorkingDraftStamp({
    garmentStyle,
    sleeveDirection: state.sleeveDirection,
    sleeveLength: state.sleeveLengthChoice,
  });

  const { finishedBust: _bust, ...styleOnly } = styleMeasurements;
  const next: SidewaysCardiganBuilderDraftState = {
    ...state,
    garmentStyle,
    styleMeasurements: styleOnly,
    userEditedStyle: {
      ...state.userEditedStyle,
      ...Object.fromEntries(
        SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS.filter((key) => edits[key] !== undefined).map(
          (key) => [key, true as const],
        ),
      ),
    },
  };
  return { ok: true, state: next, garmentStyle };
}

export function buildSidewaysCardiganSummaryDiagramInput(
  measurements: SidewaysCardiganSummaryMeasurements,
  garmentStyle: SidewaysCardiganGarmentStyle,
  unit: MeasurementDisplayUnit,
  backNeckDepthInches?: number,
): SidewaysCardiganEditMeasurementDiagramInput | null {
  const inches = summaryMeasurementsToInches(measurements, unit);
  if (
    inches.finishedBust === undefined ||
    inches.finishedLength === undefined ||
    inches.neckOpeningWidth === undefined ||
    inches.vNeckDepth === undefined ||
    inches.finishedUpperArm === undefined ||
    inches.sleeveLength === undefined ||
    inches.wrist === undefined
  ) {
    return null;
  }
  return {
    garmentStyle,
    displayUnit: unit,
    measurements: {
      finishedBustInches: inches.finishedBust,
      finishedLengthInches: inches.finishedLength,
      neckOpeningWidthInches: inches.neckOpeningWidth,
      vNeckDepthInches: inches.vNeckDepth,
      finishedUpperArmInches: inches.finishedUpperArm,
      sleeveLengthInches: inches.sleeveLength,
      wristInches: inches.wrist,
      ...(backNeckDepthInches !== undefined && backNeckDepthInches > 0
        ? { backNeckDepthInches }
        : {}),
    },
  };
}
