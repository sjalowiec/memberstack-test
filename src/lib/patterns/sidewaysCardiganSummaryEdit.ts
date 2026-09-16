/**
 * Sideways V-Neck Summary/Edit — reuse sweater override storage and the shared
 * PatternSummaryEditWorkspace chips, Body/Sleeve tabs, and Drop Shoulder
 * Upper Arm → armhole relationship. Quick edits may change style/fit/size.
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
  finishedBustInchesFromChartRow,
  parsePositiveInchesField,
  reseedSidewaysCardiganStyleMeasurements,
  SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS,
  type SidewaysCardiganStyleMeasurements,
} from "./sidewaysCardiganStyleMeasurements";
import {
  parseSidewaysCardiganGarmentStyle,
  parseSidewaysCardiganSleeveLengthChoice,
  writeSidewaysCardiganWorkingDraftStamp,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveLengthChoice,
} from "./sidewaysCardiganConstructionIdentity";
import {
  SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS,
  type SidewaysCardiganEditMeasurementDiagramInput,
} from "./sidewaysCardiganEditMeasurementDiagramSvg";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { mergeSidewaysCardiganWorkingDraft } from "./sidewaysCardiganWorkspaceLoad";
import { DROP_SHOULDER_UPPER_ARM_ARMHOLE_HINT } from "./dropShoulderEditMeasurementPreview";
import {
  findSidewaysCardiganWomenChartRow,
  resolveSidewaysCardiganChartAudienceFromSize,
  type SidewaysCardiganWomenChartAudience,
} from "./sidewaysCardiganSizeCharts";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";

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

export const SIDEWAYS_CARDIGAN_SUMMARY_BODY_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...MEASURE_INPUT,
    id: "finishedBust",
    label: "Finished bust/chest",
    previewTab: "body",
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
    previewTab: "body",
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
    previewTab: "body",
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
    previewTab: "body",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.vNeckDepth,
    transform: "translate(-50%, calc(-100% - 8px))",
    inputId: "sideways-edit-vneck-depth",
    inputDataAttr: "data-sideways-edit-vneck-depth",
    testId: "sideways-edit-chip-vneck-depth",
    inputTestId: "sideways-edit-vneck-depth",
  },
  {
    id: "armholeDepth",
    label: "Armhole depth",
    previewTab: "body",
    editable: false,
    secondary: DROP_SHOULDER_UPPER_ARM_ARMHOLE_HINT,
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
    transform: "translate(-50%, calc(-100% - 8px))",
    unitSuffixAttr: "data-sideways-edit-unit-suffix",
    testId: "sideways-edit-chip-armhole-depth",
    extraChipAttrs: { "data-sideways-armhole-help": "" },
  },
];

export const SIDEWAYS_CARDIGAN_SUMMARY_SLEEVE_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...MEASURE_INPUT,
    id: "finishedUpperArm",
    label: "Upper arm",
    previewTab: "sleeve",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm,
    transform: "translate(8px, -50%)",
    inputId: "sideways-edit-finished-upper-arm",
    inputDataAttr: "data-sideways-edit-finished-upper-arm",
    extraInputAttrs: { "data-cb-measure-input": "upperArm" },
    testId: "sideways-edit-chip-finished-upper-arm",
    inputTestId: "sideways-edit-finished-upper-arm",
    secondary: DROP_SHOULDER_UPPER_ARM_ARMHOLE_HINT,
  },
  {
    ...MEASURE_INPUT,
    id: "sleeveLength",
    label: "Sleeve length",
    previewTab: "sleeve",
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
    previewTab: "sleeve",
    targetId: SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist,
    transform: "translate(8px, -50%)",
    inputId: "sideways-edit-wrist",
    inputDataAttr: "data-sideways-edit-wrist",
    testId: "sideways-edit-chip-wrist",
    inputTestId: "sideways-edit-wrist",
  },
];

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS: PatternSummaryMeasurementField[] = [
  ...SIDEWAYS_CARDIGAN_SUMMARY_BODY_FIELDS,
  ...SIDEWAYS_CARDIGAN_SUMMARY_SLEEVE_FIELDS,
];

export const SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_KEYS = Object.keys(
  SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS,
) as SidewaysCardiganSummaryMeasurementKey[];

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

export type SidewaysCardiganSummaryQuickEdits = {
  selectedSize?: string;
  chartAudience?: SidewaysCardiganWomenChartAudience;
  garmentStyle?: SidewaysCardiganGarmentStyle;
  fit?: string;
  sleeveLengthChoice?: SidewaysCardiganSleeveLengthChoice;
};

function persistChartBustOverride(bustInches: number | undefined): void {
  if (bustInches === undefined || !(bustInches > 0)) return;
  const rounded = roundQuarter(bustInches);
  const overrides: Record<string, string> = {
    ...loadMeasurementOverrides(),
    chestBust: formatSwatchCountForGaugeInput(rounded),
  };
  persistMeasurementOverrides(overrides);
  const prevFit = {
    ...section(getCurrentPattern().fit),
    ...section(getPatternData().fit),
  };
  const fitPayload = {
    ...prevFit,
    selectedMeasurements: {
      ...section(prevFit.selectedMeasurements),
      finished_bust_chest: rounded,
    },
    cbMeasurementOverrides: overrides,
  };
  saveCurrentPattern({ fit: fitPayload });
  savePatternData("fit", fitPayload);
}

/** Size, garment style, fit, or sleeve-length picker — reseeds chart fields and remounts. */
export function applySidewaysCardiganSummaryQuickEdits(
  edits: SidewaysCardiganSummaryQuickEdits,
  state: SidewaysCardiganBuilderDraftState = readSidewaysCardiganBuilderStateFromDraft(),
): { ok: true; state: SidewaysCardiganBuilderDraftState; garmentStyle: SidewaysCardiganGarmentStyle } | { ok: false; message: string } {
  const next: SidewaysCardiganBuilderDraftState = { ...state };
  if (edits.garmentStyle) {
    const parsed = parseSidewaysCardiganGarmentStyle(edits.garmentStyle);
    if (parsed) next.garmentStyle = parsed;
  }
  if (edits.fit !== undefined && edits.fit.trim()) next.fit = edits.fit.trim();
  if (edits.sleeveLengthChoice) {
    next.sleeveLengthChoice = parseSidewaysCardiganSleeveLengthChoice(edits.sleeveLengthChoice);
  }
  if (edits.selectedSize !== undefined) next.selectedSize = edits.selectedSize.trim();
  if (edits.chartAudience) {
    next.chartAudience = edits.chartAudience;
  } else if (next.selectedSize) {
    next.chartAudience =
      resolveSidewaysCardiganChartAudienceFromSize(next.selectedSize) ?? next.chartAudience;
  }

  const reseedMeasurements =
    edits.selectedSize !== undefined ||
    edits.fit !== undefined ||
    edits.sleeveLengthChoice !== undefined;

  writeSidewaysCardiganWorkingDraftStamp({
    garmentStyle: next.garmentStyle,
    sleeveDirection: next.sleeveDirection,
    sleeveLength: next.sleeveLengthChoice,
  });

  if (reseedMeasurements) {
    const row = findSidewaysCardiganWomenChartRow(
      next.selectedSize,
      next.chartAudience || undefined,
    );
    if (!row) return { ok: false, message: "Choose a size." };
    next.chartAudience = row.chartAudience;
    next.styleMeasurements = reseedSidewaysCardiganStyleMeasurements({
      previous: next.styleMeasurements,
      userEdited: next.userEditedStyle,
      row,
      chartAudience: row.chartAudience,
      fitPreference: next.fit || "standard",
      sleeveLengthChoice: next.sleeveLengthChoice,
    });
    syncSidewaysCardiganBuilderToPatternStorage(
      {
        selectedSize: next.selectedSize,
        chartAudience: row.chartAudience,
        fit: next.fit || "standard",
        garmentStyle: next.garmentStyle,
        styleMeasurements: next.styleMeasurements,
        gaugeStitchRaw: next.gaugeStitchRaw,
        gaugeRowRaw: next.gaugeRowRaw,
        availableNeedles: next.availableNeedles,
        unit: next.unit,
        sleeveDirection: next.sleeveDirection,
        sleeveLengthChoice: next.sleeveLengthChoice,
      },
      row,
    );
    if (edits.selectedSize !== undefined || edits.fit !== undefined) {
      persistChartBustOverride(finishedBustInchesFromChartRow(row, next.fit || "standard"));
    }
  }

  writeSidewaysCardiganWorkingDraftStamp({
    garmentStyle: next.garmentStyle,
    sleeveDirection: next.sleeveDirection,
    sleeveLength: next.sleeveLengthChoice,
  });

  return { ok: true, state: next, garmentStyle: next.garmentStyle };
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
