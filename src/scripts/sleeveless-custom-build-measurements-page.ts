/**
 * Custom Build — Measurements step (`/patterns/sleeveless/custom-build/fit/`).
 * Sleeveless body diagram with editable inches; values in `cbMeasurementOverrides` only.
 */
import {
  formatSwatchCountForGaugeInput,
  swatchCountFromPerInchForDisplay,
} from "../lib/patterns/gaugeDisplayFormat";
import {
  formatMeasurementDisplayFromInches,
  inchesToCmRounded,
  parseMeasurementInputToInches,
  type MeasurementDisplayUnit,
} from "../lib/patterns/patternMeasurementDisplayUnit";
import { getDefaultHemLengthInches, getDefaultCuffLengthInches } from "../lib/patterns/hemDefaults";
import {
  getCurrentPattern,
  getPatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "../lib/patterns/patternStorage";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "../lib/patterns/sleevelessCustomMeasurementStorage";
import {
  prepareCustomBuildPatternGeneration,
} from "../lib/patterns/prepareCustomBuildPatternGeneration";
import { scheduleCaptureCustomPatternDirtyBaselineAfterHydration } from "../lib/patterns/customPatternSavedProjectDirtyState";
import { wirePatternWorkspacePatternTabPreGeneration } from "../lib/patterns/patternWorkspacePatternTabNavigation";
import {
  computeDefaultMeasurementsFromChartRow,
  expressWhoToChartAudience,
  findExpressChartRow,
  getExpressChartRowsForAudience,
  getExpressUiUnit,
  loadExpressSweaterCharts,
  resolveExpressChartFit,
  SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import type { ChartRow } from "../lib/patterns/sleevelessExpressSizeChartTypes";
import { buildSleevelessCustomBuildValidationInput } from "../lib/patterns/sleevelessCustomBuildValidationInput";
import { validateSleevelessPatternInputs } from "../lib/patterns/sleevelessPatternValidation";
import {
  CB_MEASURE_CONTINUE_LABEL_DEFAULT,
  renderCbMeasureValidationOverlay,
  setCbMeasureContinueButton,
} from "../lib/patterns/sleevelessPatternValidationUi";
import {
  renderMeasureReviewSummaryLine,
  type MeasureReviewSummarySegment,
} from "../lib/patterns/sleevelessMeasureReviewSummaryUi";
import { SLEEVELESS_REVIEW_CONTEXT_READY_EVENT } from "../lib/patterns/sleevelessPatternProjectMeta";
import { resolveSleevelessGarmentKind } from "../lib/patterns/resolveSleevelessGarmentKind";
import { readCustomBuildWizardGarmentType } from "../lib/patterns/sleevelessCustomBuildWizardNeckline";
import {
  applyMeasurementTargetToBox,
  applyMeasurementBlueprintViewBoxAspect,
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS,
} from "../lib/patterns/patternSummaryMeasurementOverlay";
import {
  isCustomBuildDiagramFieldActiveForConstruction,
  isCustomBuildDiagramFieldRenderedOnSummary,
  isDropShoulderDisplayOnlySummaryField,
} from "../lib/patterns/customBuildDiagramFieldPolicy";
import { computeDropShoulderArmholeDepthInches } from "../lib/patterns/dropShoulderArmholeDepth";
import {
  buildDropShoulderReviewDisplayIdentity,
  buildDropShoulderReviewMergedInches,
  commitDropShoulderReviewDiagramHydration,
  forceRefreshDropShoulderSummaryMeasurements,
  forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing,
  readDropShoulderReviewDiagramDirty,
  resolveDropShoulderSummarySizingFromPattern,
  type DropShoulderQuickEditSizing,
} from "../lib/patterns/dropShoulderReviewDiagramRefresh";
import {
  isDropShoulderConstruction,
  isDropShoulderWorkspaceMeasurementSummaryPage,
  resolveMeasurementBlueprintSvgUrl,
  DROP_SHOULDER_SUMMARY_ASPECT_RATIO_CSS,
  SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL,
} from "../lib/patterns/measurementBlueprintSvgUrl";
import { mapExpressStyleKey } from "../lib/patterns/syncSleevelessExpressDesignToStorage";
import {
  markDropShoulderSleeveOverrideKeyUserEdited,
  readEffectiveDropShoulderUserEditedSleeveFields,
} from "../lib/patterns/dropShoulderUserEditedSleeveFields";
import {
  dropShoulderEditWorkspaceCuffCircumferenceDisplayInches,
  dropShoulderEditWorkspaceSleeveLengthDisplayInches,
  resolveDropShoulderSleeveOverrideStrings,
  scaleDropShoulderSleeveLengthInches,
} from "../lib/patterns/dropShoulderSleeveMeasurementOverrides";

const YARN_GAUGE_HREF = "/patterns/sleeveless/custom-build/yarn-gauge";
const PATTERN_WORKSPACE_TAB_PATTERN_HREF = "/patterns/sleeveless/pattern/?tab=pattern";

export type { DropShoulderQuickEditSizing };

export type DropShoulderWorkspaceRehydrateMeta = {
  oldSize?: string;
};

let dropShoulderWorkspaceRehydrateImpl:
  | ((sizing: DropShoulderQuickEditSizing, meta?: DropShoulderWorkspaceRehydrateMeta) => Promise<boolean>)
  | null = null;

let dropShoulderWorkspaceSummaryRefreshImpl: (() => Promise<void>) | null = null;

let patternWorkspaceMeasurementDiagramRehydrateImpl: (() => Promise<void>) | null = null;

/**
 * Re-render the Edit Pattern measurement diagram from the current saved working draft, in the
 * workspace's active display unit. Used when the Edit drawer reopens so a canceled unit switch (or
 * any discarded edit) always reappears reading canonical inches — never a stale display unit or
 * an unsaved value left in memory. No-op until the measurement editor has been initialised.
 */
export async function rehydratePatternWorkspaceMeasurementDiagram(): Promise<void> {
  if (!patternWorkspaceMeasurementDiagramRehydrateImpl) return;
  await patternWorkspaceMeasurementDiagramRehydrateImpl();
}

/** Called from Edit Pattern → Measurements when Quick edits Size changes (Drop Shoulder only). */
export async function rehydrateDropShoulderWorkspaceMeasurementDiagramFromQuickEdit(
  sizing: DropShoulderQuickEditSizing,
  meta?: DropShoulderWorkspaceRehydrateMeta,
): Promise<boolean> {
  if (!dropShoulderWorkspaceRehydrateImpl) {
    return false;
  }
  return dropShoulderWorkspaceRehydrateImpl(sizing, meta);
}

/**
 * Re-render the Drop Shoulder measurement summary diagram from the current saved pattern data.
 * Used after an edit save so the sleeve length field matches the regenerated instructions.
 */
export async function refreshDropShoulderWorkspaceMeasurementSummary(): Promise<void> {
  if (!dropShoulderWorkspaceSummaryRefreshImpl) return;
  await dropShoulderWorkspaceSummaryRefreshImpl();
}

function readDropShoulderWorkspaceQuickEditGaugeFromDom(): string | null {
  const spiInput = document.querySelector<HTMLInputElement>("#sl-edit-spi");
  const rpiInput = document.querySelector<HTMLInputElement>("#sl-edit-rpi");
  const stitchRaw = spiInput?.value.trim() ?? "";
  const rowRaw = rpiInput?.value.trim() ?? "";
  if (!stitchRaw || !rowRaw) return null;
  const pattern = getCurrentPattern();
  const yg = pattern.yarnGauge as Record<string, unknown> | undefined;
  const ygm = pattern.yarnGaugeMachine as Record<string, unknown> | undefined;
  const unit =
    String(ygm?.gaugeRawUnit ?? yg?.gaugeRawUnit ?? "in").trim() === "cm" ? "cm" : "in";
  const over = unit === "cm" ? "10 cm" : '4"';
  return `${stitchRaw} sts × ${rowRaw} rows / ${over}`;
}

function readDropShoulderWorkspaceQuickEditSummaryFromDom(
  sizing: DropShoulderQuickEditSizing,
): {
  who: string;
  size: string;
  garment: string;
  neckline: string;
  fit: string;
  gauge: string | null;
} {
  const expressValues = readExpressValues();
  const garmentRadio = document.querySelector<HTMLInputElement>('input[name="sl-edit-garment"]:checked');
  const garment = garmentRadio?.value === "cardigan" ? "Cardigan" : "Pullover";
  const neckRadio = document.querySelector<HTMLInputElement>('input[name="sl-edit-neckline"]:checked');
  const neckline = necklineLabel(neckRadio?.value === "v-neck" ? "v-neck" : "round");
  const who =
    expressValues.who ||
    (sizing.audience === "men"
      ? "men"
      : sizing.audience === "kids"
        ? "kids"
        : sizing.audience === "baby"
          ? "baby"
          : "women");
  return {
    who,
    size: sizing.selectedSize,
    garment,
    neckline,
    fit: sizing.fitPreference,
    gauge: readDropShoulderWorkspaceQuickEditGaugeFromDom() ?? gaugeSummary(getCurrentPattern()),
  };
}

export function readDropShoulderWorkspaceQuickEditSizingFromDom(): DropShoulderQuickEditSizing | null {
  if (typeof document === "undefined") return null;
  if (!isDropShoulderWorkspaceMeasurementSummaryPage()) return null;
  const sizeSelect = document.querySelector<HTMLSelectElement>("[data-sl-edit-size]");
  const selectedSize = sizeSelect?.value.trim() ?? "";
  const pattern = getCurrentPattern();
  const expressValues = readExpressValues();
  const fit = pattern.fit ?? {};
  const fitPreference = resolveFitPreference(expressValues, fit);
  if (!selectedSize) return null;
  const audience =
    expressWhoToChartAudience(fit.sizingChart) ||
    expressWhoToChartAudience(pattern.style?.recipientCategory) ||
    expressWhoToChartAudience(expressValues.who) ||
    "misses";
  return { audience, selectedSize, fitPreference };
}

export type CustomBuildMeasurementsInitOptions = {
  /** When set, Continue navigates here instead of Custom Build yarn & gauge. */
  continueHref?: string;
  /** When set, runs after validation + persist instead of default navigation. */
  onContinue?: () => void;
  /** When true, diagram fields are read-only (unified review for free users). */
  readOnly?: boolean;
  /** Keep unit toggle in summary host when rendering build summary (unified review). */
  preserveUnitsHost?: boolean;
  /**
   * Explicit display unit for pages WITHOUT the built-in review unit toggle (e.g. the Edit
   * Pattern workspace). The diagram displays / accepts edits in the returned unit and converts to
   * canonical inches on save. The Edit workspace supplies a mutable resolver so its own Inches/
   * Centimeters control can switch the working unit live. When omitted, unit display is driven by
   * `preserveUnitsHost` (toggle) or defaults to inches.
   */
  resolveDisplayUnit?: () => MeasurementDisplayUnit;
  /**
   * Toggle id whose `kbm:units-change` events should re-display the diagram. Defaults to the
   * review/builder toggle ({@link SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID}). The Edit Pattern
   * workspace passes its own control id so switching units there re-renders the diagram (while
   * preserving unsaved edits) via the same conversion path.
   */
  unitChangeToggleId?: string;
};

/**
 * Diagram fields (inches, stored as decimal strings). The first 8 are the shared sleeveless body
 * fields; the trailing 3 are Drop Shoulder–only sleeve fields (rendered only when the active
 * construction is drop-shoulder — see {@link getActiveDiagramFields}).
 */
const DIAGRAM_FIELD_KEYS = [
  "finishedNeckOpeningWidth",
  "neckDepth",
  "shoulderWidth",
  "armholeDepth",
  "chestBust",
  "hip",
  "finishedLength",
  "hemDepth",
  "upperArm",
  "wrist",
  "sleeveLength",
  "cuffDepth",
] as const;

type DiagramFieldKey = (typeof DIAGRAM_FIELD_KEYS)[number];

type DiagramFieldDef = {
  key: DiagramFieldKey;
  positionMod: string;
  targetId: string;
  /** Drop Shoulder summary SVG target (drop_shoulder_summary.svg). */
  dropShoulderTargetId?: string;
  /** Optional CSS transform for anchor alignment (e.g. hem chip above target). */
  anchorTransform?: string;
  label: string;
  labelLines?: string[];
  axis?: "horizontal" | "vertical";
  /** Rendered only for drop-shoulder construction (sleeve measurements). */
  dropShoulderOnly?: boolean;
  /** When true, an empty value is allowed (no "Required" error) — sleeve fields fall back to chart. */
  optional?: boolean;
  defaultInches: (row: ChartRow, computed: Record<string, number>, audience: string) => number | undefined;
};

const DIAGRAM_FIELDS: DiagramFieldDef[] = [
  {
    key: "finishedNeckOpeningWidth",
    positionMod: "neck-opening",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
    label: "Neck opening",
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.neck_width, toFinite(row.neck_opening)),
  },
  {
    key: "neckDepth",
    positionMod: "neckline-depth",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
    label: "Neck depth",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.front_neck_depth, toFinite(row.front_neck_depth)),
  },
  {
    key: "shoulderWidth",
    positionMod: "shoulder",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.chest,
    label: "Shoulder width",
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.shoulder_width, toFinite(row.shoulder_width)),
  },
  {
    key: "armholeDepth",
    positionMod: "armhole",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
    label: "Armhole depth",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.armhole_depth, toFinite(row.armhole_depth)),
  },
  {
    key: "chestBust",
    positionMod: "finished-bust",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.bust,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.bust,
    label: "Finished bust circ",
    labelLines: ["Finished", "bust circ"],
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.finished_bust_chest, toFinite(row.bust_or_chest)),
  },
  {
    key: "hip",
    positionMod: "hip-width",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.hip,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.hip,
    label: "Hip circ",
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(
        computed.finished_hip,
        toFinite(row.hip),
        computed.finished_bust_chest,
        toFinite(row.bust_or_chest),
      ),
  },
  {
    key: "finishedLength",
    positionMod: "back-length",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.garmentLength,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.garmentLength,
    label: "Garment length",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.back_neck_to_hem, toFinite(row.garment_back_length)),
  },
  {
    key: "hemDepth",
    positionMod: "ribbed-hem-depth",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.hem,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.hem,
    anchorTransform: "translate(-50%, -100%)",
    label: "Hem depth",
    axis: "vertical",
    defaultInches: (_row, _computed, audience) => getDefaultHemLengthInches(audience),
  },
  // --- Drop Shoulder–only sleeve fields (chart keys: upper_arm / wrist / sleeve_length) ---
  {
    key: "upperArm",
    positionMod: "upper-arm",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.upperArm,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.upperArm,
    label: "Upper arm circ",
    labelLines: ["Upper arm", "circ"],
    axis: "horizontal",
    dropShoulderOnly: true,
    optional: true,
    defaultInches: (row, computed) =>
      pickPositive(computed.upper_arm, toFinite(row.upper_arm)),
  },
  {
    key: "sleeveLength",
    positionMod: "arm-length",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.armLength,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.armLength,
    label: "Sleeve length",
    axis: "vertical",
    dropShoulderOnly: true,
    optional: true,
    defaultInches: (row, computed) =>
      pickPositive(computed.sleeve_length, toFinite(row.sleeve_length)),
  },
  {
    key: "wrist",
    positionMod: "cuff-circumference",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference,
    label: "Cuff circ",
    labelLines: ["Cuff", "circ"],
    axis: "horizontal",
    dropShoulderOnly: true,
    optional: true,
    defaultInches: (row, computed) => pickPositive(computed.wrist, toFinite(row.wrist)),
  },
  {
    key: "cuffDepth",
    positionMod: "cuff-length",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.armLength,
    dropShoulderTargetId: DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffDepth,
    label: "Cuff length",
    axis: "vertical",
    dropShoulderOnly: true,
    defaultInches: (_row, _computed, audience) => getDefaultCuffLengthInches(audience),
  },
];

function resolveDiagramFieldTargetId(field: DiagramFieldDef): string {
  if (isDropShoulderConstruction() && field.dropShoulderTargetId) {
    return field.dropShoulderTargetId;
  }
  return field.targetId;
}

function isDropShoulderEditWorkspace(): boolean {
  return isDropShoulderWorkspaceMeasurementSummaryPage();
}

function dropShoulderDiagramFieldPolicyOptions(): { dropShoulderEditWorkspace: boolean } {
  return { dropShoulderEditWorkspace: isDropShoulderEditWorkspace() };
}

/**
 * Diagram fields for the active construction:
 * - Sleeveless: the 8 body fields (sleeve fields are excluded).
 * - Drop shoulder: body fields minus Armhole Depth (derived = upper arm ÷ 2) and Shoulder Width
 *   (flat body width = finished bust ÷ 2 at generation — not shown on summary), plus sleeve fields.
 */
function getActiveDiagramFields(): DiagramFieldDef[] {
  const dropShoulder = isDropShoulderConstruction();
  const policyOptions = dropShoulderDiagramFieldPolicyOptions();
  return DIAGRAM_FIELDS.filter((field) =>
    isCustomBuildDiagramFieldActiveForConstruction(field, dropShoulder, policyOptions),
  );
}

/** Transform merged overrides for diagram display on the Edit Pattern workspace. */
function dropShoulderEditWorkspaceMergedForDiagram(
  merged: Record<DiagramFieldKey, string>,
): Record<DiagramFieldKey, string> {
  if (!isDropShoulderEditWorkspace()) return merged;
  const userEdited = readEffectiveDropShoulderUserEditedSleeveFields(getCurrentPattern().fit);
  const sleeveLengthChoice = readDropShoulderSleeveLengthChoice();
  let out = merged;
  const displaySleeveLength = dropShoulderEditWorkspaceSleeveLengthDisplayInches({
    overrideInches: merged.sleeveLength ?? "",
    sleeveLengthChoice,
    userEditedSleeveLength: userEdited.sleeveLength === true,
  });
  if (displaySleeveLength) {
    out = { ...out, sleeveLength: displaySleeveLength };
  }
  const displayCuffCirc = dropShoulderEditWorkspaceCuffCircumferenceDisplayInches({
    overrideInches: merged.wrist ?? "",
    upperArmInches: merged.upperArm ?? "",
    sleeveLengthChoice,
    userEditedCuffCircumference: userEdited.cuffCircumference === true,
  });
  if (displayCuffCirc) {
    out = { ...out, wrist: displayCuffCirc };
  }
  return out;
}

function dropShoulderArmholeDepthInchesFromMerged(
  merged: Record<DiagramFieldKey, string>,
): string {
  const upperArm = parseInchesInput(merged.upperArm ?? "");
  const depth = computeDropShoulderArmholeDepthInches(upperArm);
  return depth !== undefined ? formatInchesInput(depth) : "";
}

/** Sleeve-length picker choice from the working draft style (canonical wins over builder mirror). */
function readDropShoulderSleeveLengthChoice(): unknown {
  const canonical = (getCurrentPattern().style ?? {}) as Record<string, unknown>;
  const pb = (getPatternData().style ?? {}) as Record<string, unknown>;
  return canonical.sleeveLength ?? pb.sleeveLength;
}

/**
 * Read-only value (inch string) for a drop-shoulder display-only diagram field:
 * - `armholeDepth`: derived from upper arm ÷ 2.
 */
function dropShoulderDisplayOnlyFieldInches(
  fieldKey: DiagramFieldKey,
  merged: Record<DiagramFieldKey, string>,
): string {
  if (fieldKey === "sleeveLength") {
    const scaled = scaleDropShoulderSleeveLengthInches(
      parseInchesInput(merged.sleeveLength ?? ""),
      readDropShoulderSleeveLengthChoice(),
    );
    return scaled !== undefined ? formatInchesInput(scaled) : "";
  }
  return dropShoulderArmholeDepthInchesFromMerged(merged);
}

/** Field keys rendered for the active construction (validation / collect / persist gate). */
function activeFieldKeys(): DiagramFieldKey[] {
  return getActiveDiagramFields().map((field) => field.key);
}

function toFinite(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function pickPositive(...candidates: (number | undefined)[]): number | undefined {
  for (const c of candidates) {
    if (c !== undefined && Number.isFinite(c) && c > 0) return c;
  }
  return undefined;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function formatInchesInput(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "";
  return formatSwatchCountForGaugeInput(roundQuarter(n));
}

function parseInchesInput(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return roundQuarter(n);
}

type UiLengthUnit = MeasurementDisplayUnit;

/** Display-only: stored inch string → readonly chip text. */
function formatReadonlyMeasurementDisplay(rawInches: string, unit: UiLengthUnit): string {
  const trimmed = rawInches.trim();
  if (!trimmed) return "—";
  const inches = parseInchesInput(trimmed);
  if (inches === undefined) return trimmed;
  if (unit === "cm") return `${inchesToCmRounded(inches)} cm`;
  return `${formatSwatchCountForGaugeInput(inches)} in`;
}

function readExpressValues(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    const v = (p as Record<string, unknown>).values;
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return {};
}

function resolveFitPreference(
  expressValues: Record<string, string>,
  patternFit: Record<string, unknown>,
): string {
  const ev = expressValues.fit;
  if (ev === "close" || ev === "standard" || ev === "relaxed") return ev;
  const ease = patternFit.easeChoice ?? patternFit.fitChoice;
  if (ease === "close" || ease === "standard" || ease === "relaxed") return String(ease);
  return "standard";
}

function computeDefaultsFromChart(
  row: ChartRow,
  fitPreference: string,
  audience: string,
): Record<DiagramFieldKey, string> {
  const computed = computeDefaultMeasurementsFromChartRow(row, fitPreference);
  const out: Partial<Record<DiagramFieldKey, string>> = {};
  for (const field of DIAGRAM_FIELDS) {
    const inches = field.defaultInches(row, computed, audience);
    if (inches !== undefined) out[field.key] = formatInchesInput(inches);
  }
  return out as Record<DiagramFieldKey, string>;
}

function mergeOverridesWithDefaults(
  saved: Record<string, string>,
  defaults: Record<DiagramFieldKey, string>,
): Record<DiagramFieldKey, string> {
  const merged = { ...defaults };
  const dropShoulder = isDropShoulderConstruction();
  for (const key of DIAGRAM_FIELD_KEYS) {
    if (dropShoulder && key === "shoulderWidth") continue;
    const s = saved[key]?.trim();
    if (s) merged[key] = s;
  }
  return merged;
}

function applyExpressMeasurementBlueprintSvgDisplay(svg: SVGElement): void {
  svg.querySelector("#line-waist-width")?.setAttribute("visibility", "hidden");
  const hemLine = svg.querySelector("#line-hem-width");
  if (hemLine instanceof SVGGraphicsElement) {
    hemLine.removeAttribute("visibility");
    hemLine.style.visibility = "visible";
    hemLine.style.opacity = "1";
  }
  const shoulderLine = svg.querySelector("#line-chest-width");
  if (shoulderLine instanceof SVGGraphicsElement) {
    shoulderLine.removeAttribute("visibility");
    shoulderLine.style.visibility = "visible";
    shoulderLine.style.opacity = "1";
  }
}

async function createMeasurementBlueprintArt(): Promise<SVGElement | HTMLImageElement> {
  const svgUrl = resolveMeasurementBlueprintSvgUrl();
  const ariaLabel = isDropShoulderConstruction()
    ? "Drop shoulder sweater measurement diagram"
    : "Sleeveless sweater body measurement diagram";
  try {
    let root: SVGSVGElement;
    if (cachedBlueprintSvgTemplate?.url === svgUrl) {
      root = cachedBlueprintSvgTemplate.template;
    } else {
      const res = await fetch(svgUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const svgText = await res.text();
      const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const parsedRoot = parsed.documentElement;
      if (!(parsedRoot instanceof SVGSVGElement)) throw new Error("not an SVG root");
      cachedBlueprintSvgTemplate = { url: svgUrl, template: parsedRoot };
      root = parsedRoot;
    }
    const svg = document.importNode(root, true);
    if (!(svg instanceof SVGSVGElement)) throw new Error("import failed");
    applyExpressMeasurementBlueprintSvgDisplay(svg);
    svg.classList.add("express-mbp-art");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", ariaLabel);
    svg.setAttribute("focusable", "false");
    return svg;
  } catch {
    const img = document.createElement("img");
    img.className = "express-mbp-art";
    img.src = svgUrl;
    if (svgUrl === SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL) {
      img.width = 142;
      img.height = 195;
    } else {
      img.width = 229;
      img.height = 423;
    }
    img.alt = ariaLabel;
    img.decoding = "async";
    return img;
  }
}

function whoLabel(who: string): string {
  if (who === "women") return "Women";
  if (who === "men") return "Men";
  if (who === "kids") return "Kids";
  if (who === "baby") return "Baby";
  return who || "—";
}

function fitLabel(fit: string): string {
  if (!fit) return "—";
  return fit.charAt(0).toUpperCase() + fit.slice(1);
}

function necklineLabel(neckline: string): string {
  if (neckline === "v-neck") return "V-neck";
  if (neckline === "round") return "Round";
  return neckline || "—";
}

function garmentStyleLabel(expressValues: Record<string, string>, pattern: ReturnType<typeof getCurrentPattern>): string {
  const style = pattern.style ?? {};
  const pbStyle = (getPatternData().style ?? {}) as Record<string, unknown>;
  const kind = resolveSleevelessGarmentKind({
    wizardGarmentType: readCustomBuildWizardGarmentType(),
    canonicalStyle: style as Record<string, unknown>,
    patternBuilderStyle: pbStyle,
    expressValues,
  });
  const base = kind.isCardigan ? "Cardigan" : "Pullover";
  const shape = String(expressValues.shape ?? style.shape ?? "").trim();
  if (shape && shape !== "straight") {
    const shapeLabel = shape.charAt(0).toUpperCase() + shape.slice(1);
    return `${base}, ${shapeLabel}`;
  }
  return base;
}

function gaugeSummary(pattern: ReturnType<typeof getCurrentPattern>): string | null {
  const yarnG = pattern.yarnGauge as Record<string, unknown> | undefined;
  const yarnM = pattern.yarnGaugeMachine as Record<string, unknown> | undefined;
  const stitchRaw = String(yarnM?.gaugeStitchRaw ?? yarnG?.gaugeStitchRaw ?? "").trim();
  const rowRaw = String(yarnM?.gaugeRowRaw ?? yarnG?.gaugeRowRaw ?? "").trim();
  const unit = String(yarnM?.gaugeRawUnit ?? yarnG?.gaugeRawUnit ?? "in").trim() === "cm" ? "cm" : "in";
  const over = unit === "cm" ? "10 cm" : '4"';
  if (stitchRaw && rowRaw) return `${stitchRaw} sts × ${rowRaw} rows / ${over}`;
  // Fallback: derive the swatch counts (over 4" / 10 cm) from stored per-inch values so this
  // summary never shows per-inch gauge, keeping it consistent with the Edit Pattern inputs.
  const spi = parseFloat(String(yarnG?.stitchGauge ?? yarnM?.gaugeStitchesPerInch ?? "").trim());
  const rpi = parseFloat(String(yarnG?.rowGauge ?? yarnM?.gaugeRowsPerInch ?? "").trim());
  if (Number.isFinite(spi) && spi > 0 && Number.isFinite(rpi) && rpi > 0) {
    const stitchSwatch = swatchCountFromPerInchForDisplay(spi, unit);
    const rowSwatch = swatchCountFromPerInchForDisplay(rpi, unit);
    if (stitchSwatch && rowSwatch) return `${stitchSwatch} sts × ${rowSwatch} rows / ${over}`;
  }
  return null;
}

function renderBuildSummary(
  el: HTMLElement,
  ctx: {
    who: string;
    size: string;
    garment: string;
    neckline: string;
    fit: string;
    gauge: string | null;
  },
  options?: { preserveUnitsHost?: boolean },
): void {
  const segments: MeasureReviewSummarySegment[] = [
    { label: "Recipient", value: whoLabel(ctx.who) },
    { label: "Size", value: ctx.size || "—" },
    { label: "Garment", value: ctx.garment },
    { label: "Neckline", value: ctx.neckline },
    { label: "Fit", value: fitLabel(ctx.fit) },
  ];
  if (ctx.gauge) segments.push({ label: "Gauge", value: ctx.gauge });
  renderMeasureReviewSummaryLine(el, segments, {
    preserveUnitsHost: options?.preserveUnitsHost === true,
  });
}

type BlueprintBoxOpts = {
  axis?: "horizontal" | "vertical";
  labelLines?: string[];
};

function createDiagramFieldBox(
  field: DiagramFieldDef,
  valueInches: string,
  unit: UiLengthUnit,
  opts?: BlueprintBoxOpts,
): HTMLElement {
  const box = document.createElement("div");
  box.className = `express-mbp-box express-mbp-box--${field.positionMod}`;

  const lab = document.createElement("span");
  lab.className = "express-mbp-box__lab";
  const lines = opts?.labelLines?.filter((s) => s.trim());
  if (opts?.axis === "vertical" || opts?.axis === "horizontal") {
    const icon = document.createElement("span");
    icon.className = "measure-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = opts.axis === "vertical" ? "↕" : "↔";
    lab.appendChild(icon);
    if (lines?.length) {
      const stack = document.createElement("span");
      stack.className = "express-mbp-box__lab-stack";
      for (const line of lines) {
        const text = document.createElement("span");
        text.className = "express-mbp-box__lab-text express-mbp-box__lab-line";
        text.textContent = line;
        stack.appendChild(text);
      }
      lab.appendChild(stack);
    } else {
      const text = document.createElement("span");
      text.className = "express-mbp-box__lab-text";
      text.textContent = field.label;
      lab.appendChild(text);
    }
  } else if (lines?.length) {
    const stack = document.createElement("span");
    stack.className = "express-mbp-box__lab-stack";
    for (const line of lines) {
      const text = document.createElement("span");
      text.className = "express-mbp-box__lab-text express-mbp-box__lab-line";
      text.textContent = line;
      stack.appendChild(text);
    }
    lab.appendChild(stack);
  } else {
    lab.textContent = field.label;
  }

  const fieldRow = document.createElement("div");
  fieldRow.className = "express-mbp-box__field";

  const chip = document.createElement("div");
  chip.className = "measurement-chip";

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.className = "measurement-input express-mbp-box__input";
  input.setAttribute("data-cb-measure-input", field.key);
  input.setAttribute("aria-label", `${field.label} in ${unit === "cm" ? "centimeters" : "inches"}`);
  input.value = formatMeasurementDisplayFromInches(parseInchesInput(valueInches), unit);

  const unitEl = document.createElement("span");
  unitEl.className = "measurement-unit express-mbp-box__unit";
  unitEl.setAttribute("data-cb-measure-unit-suffix", "");
  unitEl.setAttribute("aria-hidden", "true");
  unitEl.textContent = unit;

  chip.append(input, unitEl);
  fieldRow.append(chip);

  const err = document.createElement("span");
  err.className = "express-mbp-box__error";
  err.setAttribute("data-cb-measure-error", field.key);
  err.hidden = true;

  box.append(lab, fieldRow, err);
  applyMeasurementTargetToBox(box, resolveDiagramFieldTargetId(field), {
    transform: field.anchorTransform,
  });
  return box;
}

function createDiagramReadonlyFieldBox(
  field: DiagramFieldDef,
  valueInches: string,
  unit: UiLengthUnit,
  opts?: BlueprintBoxOpts,
): HTMLElement {
  const box = document.createElement("div");
  box.className = `express-mbp-box express-mbp-box--${field.positionMod}`;

  const lab = document.createElement("span");
  lab.className = "express-mbp-box__lab";
  const lines = opts?.labelLines?.filter((s) => s.trim());
  if (opts?.axis === "vertical" || opts?.axis === "horizontal") {
    const icon = document.createElement("span");
    icon.className = "measure-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = opts.axis === "vertical" ? "↕" : "↔";
    lab.appendChild(icon);
    if (lines?.length) {
      const stack = document.createElement("span");
      stack.className = "express-mbp-box__lab-stack";
      for (const line of lines) {
        const text = document.createElement("span");
        text.className = "express-mbp-box__lab-text express-mbp-box__lab-line";
        text.textContent = line;
        stack.appendChild(text);
      }
      lab.appendChild(stack);
    } else {
      const text = document.createElement("span");
      text.className = "express-mbp-box__lab-text";
      text.textContent = field.label;
      lab.appendChild(text);
    }
  } else if (lines?.length) {
    const stack = document.createElement("span");
    stack.className = "express-mbp-box__lab-stack";
    for (const line of lines) {
      const text = document.createElement("span");
      text.className = "express-mbp-box__lab-text express-mbp-box__lab-line";
      text.textContent = line;
      stack.appendChild(text);
    }
    lab.appendChild(stack);
  } else {
    lab.textContent = field.label;
  }

  const valEl = document.createElement("span");
  valEl.className = "express-mbp-box__value";
  valEl.setAttribute("data-cb-measure-readonly-value", "");
  valEl.textContent = formatReadonlyMeasurementDisplay(valueInches, unit);

  box.append(lab, valEl);
  applyMeasurementTargetToBox(box, resolveDiagramFieldTargetId(field), {
    transform: field.anchorTransform,
  });
  return box;
}

let diagramOverlayPositionCleanup: (() => void) | null = null;
let cachedBlueprintSvgTemplate: { url: string; template: SVGSVGElement } | null = null;
let lastSummaryDiagramRenderKey = "";

function stampDropShoulderMeasurementPageShell(root: HTMLElement): void {
  if (!isDropShoulderConstruction()) return;
  root.setAttribute("data-express-construction", "drop-shoulder");
  if (isDropShoulderWorkspaceMeasurementSummaryPage()) {
    root.setAttribute("data-drop-shoulder-workspace-measure-summary", "");
  }
  const pageShell = root.closest(".express-measurements-confirm-page");
  if (pageShell instanceof HTMLElement) {
    pageShell.setAttribute("data-express-construction", "drop-shoulder");
    pageShell.style.setProperty(
      "--pattern-summary-aspect-ratio",
      DROP_SHOULDER_SUMMARY_ASPECT_RATIO_CSS,
    );
  }
}

function collectValues(
  root: HTMLElement,
  options?: { displayUnit?: UiLengthUnit | null },
): Record<DiagramFieldKey, string> {
  const displayUnit = options?.displayUnit;
  const out = {} as Record<DiagramFieldKey, string>;
  for (const key of activeFieldKeys()) {
    const input = root.querySelector<HTMLInputElement>(`[data-cb-measure-input="${key}"]`);
    const raw = input?.value.trim() ?? "";
    if (displayUnit == null) {
      out[key] = raw;
      continue;
    }
    const inches = parseMeasurementInputToInches(raw, displayUnit);
    out[key] = inches !== undefined ? formatInchesInput(inches) : raw;
  }
  return out;
}

function setFieldError(root: HTMLElement, key: DiagramFieldKey, message: string | null): void {
  const box = root.querySelector(`[data-cb-measure-input="${key}"]`)?.closest(".express-mbp-box");
  const err = root.querySelector(`[data-cb-measure-error="${key}"]`);
  if (box instanceof HTMLElement) {
    box.classList.toggle("express-mbp-box--invalid", !!message);
  }
  if (err instanceof HTMLElement) {
    if (message) {
      err.textContent = message;
      err.hidden = false;
    } else {
      err.textContent = "";
      err.hidden = true;
    }
  }
}

function clearAllFieldErrors(root: HTMLElement): void {
  for (const key of activeFieldKeys()) setFieldError(root, key, null);
}

function validateFields(root: HTMLElement, displayUnit: UiLengthUnit | null): boolean {
  clearAllFieldErrors(root);
  let ok = true;
  const values = collectValues(root, { displayUnit });
  for (const field of getActiveDiagramFields()) {
    const raw = values[field.key];
    if (!raw) {
      // Sleeve fields are optional — empty just falls back to the chart value at generation.
      if (field.optional) continue;
      setFieldError(root, field.key, "Required");
      ok = false;
      continue;
    }
    if (parseInchesInput(raw) === undefined) {
      setFieldError(root, field.key, "Enter a positive number");
      ok = false;
    }
  }
  return ok;
}

function persistFromRoot(root: HTMLElement, displayUnit: UiLengthUnit | null): void {
  const values = collectValues(root, { displayUnit });
  const toStore: Record<string, string> = { ...loadMeasurementOverrides() };
  for (const key of activeFieldKeys()) {
    const n = parseInchesInput(values[key]);
    if (n !== undefined) toStore[key] = formatInchesInput(n);
  }
  if (isDropShoulderConstruction()) {
    delete toStore.shoulderWidth;
  }
  persistMeasurementOverrides(toStore);
}

function buildValidationInputFromRoot(
  root: HTMLElement,
  displayUnit: UiLengthUnit | null,
): ReturnType<typeof buildSleevelessCustomBuildValidationInput> {
  const values = collectValues(root, { displayUnit });
  const overrides: Record<string, string> = {};
  for (const key of activeFieldKeys()) {
    if (values[key]) overrides[key] = values[key];
  }
  return buildSleevelessCustomBuildValidationInput(overrides);
}

function continueButtonDefaultLabel(root: HTMLElement): string {
  const btn = root.querySelector("[data-cb-measure-continue]");
  const fromData = btn?.getAttribute("data-cb-measure-continue-default")?.trim();
  return fromData || CB_MEASURE_CONTINUE_LABEL_DEFAULT;
}

let cbMeasureWarningsDismissed = false;
let suppressDropShoulderSleeveUserEditTracking = false;

function applyDropShoulderSleeveResolvedToMerged(
  merged: Record<DiagramFieldKey, string>,
  row: ChartRow,
  fitPref: string,
  bodyShape?: string,
): void {
  const sleeveResolved = resolveDropShoulderSleeveOverrideStrings({
    overrides: loadMeasurementOverrides(),
    chartRow: row,
    fitPreference: fitPref,
    bodyShape,
  });
  for (const [key, val] of Object.entries(sleeveResolved)) {
    if (val) merged[key as DiagramFieldKey] = val;
  }
}

function refreshPatternValidationUi(root: HTMLElement, displayUnit: UiLengthUnit | null): boolean {
  const validationHost = root.querySelector("[data-cb-pattern-validation]");
  const continueBtn = root.querySelector("[data-cb-measure-continue]");
  if (!(validationHost instanceof HTMLElement)) return true;

  const messages = validateSleevelessPatternInputs(buildValidationInputFromRoot(root, displayUnit));
  const { errors } = renderCbMeasureValidationOverlay(validationHost, messages, {
    warningsDismissed: cbMeasureWarningsDismissed,
    onDismissWarnings: () => {
      cbMeasureWarningsDismissed = true;
      refreshPatternValidationUi(root, displayUnit);
    },
  });
  const hasErrors = errors.length > 0;
  if (hasErrors) cbMeasureWarningsDismissed = false;
  setCbMeasureContinueButton(
    continueBtn instanceof HTMLButtonElement ? continueBtn : null,
    hasErrors,
    continueButtonDefaultLabel(root),
  );
  return !hasErrors;
}

function resetCbMeasureWarningDismissal(): void {
  cbMeasureWarningsDismissed = false;
}

function refreshDropShoulderArmholeDisplay(
  root: HTMLElement,
  inchesByKey: Record<DiagramFieldKey, string>,
  unit: UiLengthUnit,
): void {
  if (!isDropShoulderConstruction()) return;
  const diagramHost = root.querySelector("[data-cb-measure-diagram]");
  if (!(diagramHost instanceof HTMLElement)) return;
  const scope = findReviewDiagramOverlay(diagramHost);
  if (!scope) return;
  const box = scope.querySelector(".express-mbp-box--armhole");
  if (!(box instanceof HTMLElement)) return;
  const valEl =
    box.querySelector("[data-cb-measure-readonly-value]") ?? box.querySelector(".express-mbp-box__value");
  if (!(valEl instanceof HTMLElement)) return;
  valEl.textContent = formatReadonlyMeasurementDisplay(
    dropShoulderArmholeDepthInchesFromMerged(inchesByKey),
    unit,
  );
}

let measureFieldPersistenceCleanup: (() => void) | null = null;

function wireFieldPersistence(root: HTMLElement, getDisplayUnit: () => UiLengthUnit | null): void {
  measureFieldPersistenceCleanup?.();
  measureFieldPersistenceCleanup = null;

  const saveFromInput = (el: HTMLInputElement): void => {
    resetCbMeasureWarningDismissal();
    const key = el.getAttribute("data-cb-measure-input") as DiagramFieldKey | null;
    if (!key) return;
    const displayUnit = getDisplayUnit();
    const n =
      displayUnit == null
        ? parseInchesInput(el.value)
        : parseMeasurementInputToInches(el.value, displayUnit);
    if (el.value.trim() && n === undefined) {
      setFieldError(root, key, "Enter a positive number");
      refreshPatternValidationUi(root, displayUnit);
      return;
    }
    setFieldError(root, key, null);
    el.closest(".express-mbp-box")?.classList.remove("express-mbp-box--invalid");
    if (
      isDropShoulderConstruction() &&
      !suppressDropShoulderSleeveUserEditTracking &&
      (key === "upperArm" ||
        key === "wrist" ||
        (key === "sleeveLength" && isDropShoulderEditWorkspace()))
    ) {
      markDropShoulderSleeveOverrideKeyUserEdited(key);
    }
    persistFromRoot(root, displayUnit);
    refreshPatternValidationUi(root, displayUnit);
    if (key === "upperArm") {
      refreshDropShoulderArmholeDisplay(root, collectValues(root, { displayUnit }), displayUnit ?? "in");
    }
  };

  const onChange = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches("[data-cb-measure-input]")) return;
    saveFromInput(target);
  };

  const onInput = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches("[data-cb-measure-input]")) return;
    resetCbMeasureWarningDismissal();
    refreshPatternValidationUi(root, getDisplayUnit());
    if (target.getAttribute("data-cb-measure-input") === "upperArm") {
      const displayUnit = getDisplayUnit();
      refreshDropShoulderArmholeDisplay(
        root,
        collectValues(root, { displayUnit: displayUnit ?? undefined }),
        displayUnit ?? "in",
      );
    }
  };

  root.addEventListener("change", onChange);
  root.addEventListener("blur", onChange, true);
  root.addEventListener("input", onInput);

  measureFieldPersistenceCleanup = () => {
    root.removeEventListener("change", onChange);
    root.removeEventListener("blur", onChange, true);
    root.removeEventListener("input", onInput);
  };
}

function findReviewDiagramOverlay(diagramHost: HTMLElement): HTMLElement | null {
  const overlay = diagramHost.querySelector(".express-mbp-overlay");
  return overlay instanceof HTMLElement ? overlay : null;
}

function applyDiagramUnitDisplay(
  diagramHost: HTMLElement,
  inchesByKey: Record<DiagramFieldKey, string>,
  readOnly: boolean,
  unit: UiLengthUnit,
): { boxesFound: number; suffixesUpdated: number; valuesUpdated: number } {
  const scope = findReviewDiagramOverlay(diagramHost) ?? diagramHost;
  let boxesFound = 0;
  let suffixesUpdated = 0;
  let valuesUpdated = 0;

  for (const field of getActiveDiagramFields()) {
    const inchesRaw = inchesByKey[field.key] ?? "";
    const box = scope.querySelector(`.express-mbp-box--${field.positionMod}`);
    if (!(box instanceof HTMLElement)) continue;
    boxesFound += 1;

    if (readOnly) {
      const valEl =
        box.querySelector("[data-cb-measure-readonly-value]") ??
        box.querySelector(".express-mbp-box__value");
      if (valEl instanceof HTMLElement) {
        valEl.textContent = formatReadonlyMeasurementDisplay(inchesRaw, unit);
        valuesUpdated += 1;
      }
      continue;
    }

    const input = box.querySelector<HTMLInputElement>(`[data-cb-measure-input="${field.key}"]`);
    const unitEl =
      box.querySelector("[data-cb-measure-unit-suffix]") ?? box.querySelector(".express-mbp-box__unit");
    const inches = parseInchesInput(inchesRaw);
    if (input) {
      input.value = formatMeasurementDisplayFromInches(inches, unit);
      input.setAttribute(
        "aria-label",
        `${field.label} in ${unit === "cm" ? "centimeters" : "inches"}`,
      );
      valuesUpdated += 1;
    }
    if (unitEl instanceof HTMLElement) {
      unitEl.textContent = unit;
      suffixesUpdated += 1;
    }
  }

  if (isDropShoulderConstruction()) {
    const policyOptions = dropShoulderDiagramFieldPolicyOptions();
    for (const field of DIAGRAM_FIELDS) {
      if (!isDropShoulderDisplayOnlySummaryField(field.key, policyOptions)) continue;
      const box = scope.querySelector(`.express-mbp-box--${field.positionMod}`);
      if (!(box instanceof HTMLElement)) continue;
      boxesFound += 1;
      const valEl =
        box.querySelector("[data-cb-measure-readonly-value]") ??
        box.querySelector(".express-mbp-box__value");
      if (valEl instanceof HTMLElement) {
        valEl.textContent = formatReadonlyMeasurementDisplay(
          dropShoulderDisplayOnlyFieldInches(field.key, inchesByKey),
          unit,
        );
        valuesUpdated += 1;
      }
    }
  }

  return { boxesFound, suffixesUpdated, valuesUpdated };
}

const REVIEW_UNIT_DEBUG = import.meta.env.DEV;

function logReviewUnitDebug(message: string, detail?: Record<string, unknown>): void {
  if (!REVIEW_UNIT_DEBUG) return;
  if (detail !== undefined) console.log(`[sleeveless-review-unit] ${message}`, detail);
  else console.log(`[sleeveless-review-unit] ${message}`);
}

function wireReadOnlyContinueToPattern(root: HTMLElement, onContinue: () => void): void {
  const existing = root.querySelector("[data-express-measurements-continue]");
  if (existing instanceof HTMLAnchorElement) {
    const anchor = existing.cloneNode(true) as HTMLAnchorElement;
    existing.replaceWith(anchor);
    anchor.href = PATTERN_WORKSPACE_TAB_PATTERN_HREF;
    anchor.removeAttribute("hidden");
    anchor.addEventListener("click", (ev: MouseEvent) => {
      ev.preventDefault();
      onContinue();
    });
    return;
  }

  const continueBtn = root.querySelector("[data-cb-measure-continue]");
  if (!(continueBtn instanceof HTMLButtonElement)) return;
  const button = continueBtn.cloneNode(true) as HTMLButtonElement;
  continueBtn.replaceWith(button);
  button.removeAttribute("hidden");
  button.addEventListener("click", () => onContinue());
}

async function renderDiagram(
  diagramHost: HTMLElement,
  pageRoot: HTMLElement,
  merged: Record<DiagramFieldKey, string>,
  readOnly: boolean,
  displayUnit: UiLengthUnit | null,
  getDisplayUnit: () => UiLengthUnit | null,
): Promise<void> {
  const unitForBoxes: UiLengthUnit = displayUnit ?? "in";
  diagramOverlayPositionCleanup?.();
  diagramOverlayPositionCleanup = null;
  diagramHost.replaceChildren();

  const wrap = document.createElement("div");
  wrap.className = "cb-measure-diagram-wrap";

  const validationOverlay = document.createElement("div");
  validationOverlay.className = "cb-validation-overlay";
  validationOverlay.setAttribute("data-cb-pattern-validation", "");
  validationOverlay.hidden = true;

  const rootMbp = document.createElement("div");
  rootMbp.className = "express-mbp express-mbp--diagram";
  const scroll = document.createElement("div");
  scroll.className = "express-mbp-scroll";
  const stage = document.createElement("div");
  stage.className = "express-mbp-stage";
  const inner = document.createElement("div");
  inner.className = "express-mbp-stage__inner";

  const art = await createMeasurementBlueprintArt();
  const overlay = document.createElement("div");
  overlay.className = "express-mbp-overlay";

  const dropShoulder = isDropShoulderConstruction();
  const policyOptions = dropShoulderDiagramFieldPolicyOptions();
  for (const field of DIAGRAM_FIELDS) {
    if (!isCustomBuildDiagramFieldRenderedOnSummary(field, dropShoulder)) continue;

    if (dropShoulder && isDropShoulderDisplayOnlySummaryField(field.key, policyOptions)) {
      overlay.appendChild(
        createDiagramReadonlyFieldBox(
          field,
          dropShoulderDisplayOnlyFieldInches(field.key, merged),
          unitForBoxes,
          { axis: field.axis, labelLines: field.labelLines },
        ),
      );
      continue;
    }

    if (!getActiveDiagramFields().some((active) => active.key === field.key)) continue;

    const boxOpts = { axis: field.axis, labelLines: field.labelLines };
    overlay.appendChild(
      readOnly
        ? createDiagramReadonlyFieldBox(field, merged[field.key] ?? "", unitForBoxes, boxOpts)
        : createDiagramFieldBox(field, merged[field.key] ?? "", unitForBoxes, boxOpts),
    );
  }

  inner.append(art, overlay);
  stage.appendChild(inner);
  scroll.appendChild(stage);
  rootMbp.appendChild(scroll);
  if (readOnly) {
    wrap.appendChild(rootMbp);
  } else {
    wrap.append(validationOverlay, rootMbp);
  }
  diagramHost.appendChild(wrap);

  if (art instanceof SVGSVGElement) {
    applyMeasurementBlueprintViewBoxAspect(art, inner);
    const anchors = collectOverlayAnchors(overlay);
    diagramOverlayPositionCleanup = bindPatternSummaryOverlayPositioning(
      inner,
      art,
      overlay,
      anchors,
    );
  }
}

export function initCustomBuildMeasurementsPage(options?: CustomBuildMeasurementsInitOptions): void {
  const root = document.querySelector("[data-cb-measure-root]");
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.cbMeasurePageInit === "true") return;
  root.dataset.cbMeasurePageInit = "true";
  stampDropShoulderMeasurementPageShell(root);

  const readOnly = options?.readOnly === true;
  // `preserveUnitsHost` keeps the summary unit-toggle host AND wires the live unit-switch
  // listener (review pages). `resolveDisplayUnit` honors a fixed build-time unit with no toggle
  // (Edit workspace). Either activates display conversion; only the toggle adds a switcher.
  const useUiUnitDisplay = options?.preserveUnitsHost === true;
  const explicitDisplayUnitResolver = options?.resolveDisplayUnit ?? null;
  const unitDisplayActive = useUiUnitDisplay || explicitDisplayUnitResolver != null;
  const expectedUnitToggleId = options?.unitChangeToggleId ?? SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID;
  const summaryEl = root.querySelector("[data-cb-build-summary]");
  const missingEl = root.querySelector("[data-cb-measure-missing]");
  const diagramHost = root.querySelector("[data-cb-measure-diagram]");
  const continueBtn = root.querySelector("[data-cb-measure-continue]");

  const getDisplayUnit = (): UiLengthUnit | null => {
    if (explicitDisplayUnitResolver) {
      return explicitDisplayUnitResolver() === "cm" ? "cm" : "in";
    }
    return useUiUnitDisplay ? getExpressUiUnit() : null;
  };
  let diagramInches = {} as Record<DiagramFieldKey, string>;
  let lastDisplayUnit: UiLengthUnit = getDisplayUnit() ?? "in";
  let diagramUnitDisplayReady = false;

  if (unitDisplayActive) {
    const onReviewUnitsChange = (ev: Event): void => {
      const ce = ev as CustomEvent<{ unit?: string; toggleId?: string }>;
      const toggleId = ce.detail?.toggleId;
      if (toggleId != null && toggleId !== expectedUnitToggleId) {
        logReviewUnitDebug("ignored: other toggle", { toggleId });
        return;
      }

      const unit: UiLengthUnit = ce.detail?.unit === "cm" ? "cm" : "in";
      logReviewUnitDebug("kbm:units-change received", {
        event: "kbm:units-change",
        unit,
        toggleId: toggleId ?? expectedUnitToggleId,
        diagramReady: diagramUnitDisplayReady,
      });

      if (!(diagramHost instanceof HTMLElement)) {
        logReviewUnitDebug("abort: diagram host missing");
        return;
      }
      if (!diagramUnitDisplayReady) {
        logReviewUnitDebug("abort: diagram not ready yet");
        return;
      }

      if (!readOnly) {
        diagramInches = collectValues(root, { displayUnit: lastDisplayUnit });
      }
      lastDisplayUnit = unit;
      const stats = applyDiagramUnitDisplay(diagramHost, diagramInches, readOnly, unit);
      logReviewUnitDebug("applyDiagramUnitDisplay", {
        unit,
        boxesFound: stats.boxesFound,
        suffixesUpdated: stats.suffixesUpdated,
        valuesUpdated: stats.valuesUpdated,
        overlayFound: !!findReviewDiagramOverlay(diagramHost),
      });
      if (!readOnly) refreshPatternValidationUi(root, getDisplayUnit());
    };

    window.addEventListener("kbm:units-change", onReviewUnitsChange);
    logReviewUnitDebug("listener attached (sync at init)", {
      toggleId: expectedUnitToggleId,
    });
  }

  if (!readOnly) {
    continueBtn?.addEventListener("click", () => {
      const displayUnit = getDisplayUnit();
      if (!validateFields(root, displayUnit)) return;
      if (!refreshPatternValidationUi(root, displayUnit)) return;
      persistFromRoot(root, displayUnit);
      prepareCustomBuildPatternGeneration({ root, awaitCharts: false });
      if (options?.onContinue) {
        options.onContinue();
        return;
      }
      window.location.assign(options?.continueHref ?? YARN_GAUGE_HREF);
    });
  }

  wirePatternWorkspacePatternTabPreGeneration();

  if (!readOnly) {
    wireFieldPersistence(root, getDisplayUnit);
  }

  let workspaceSummaryDiagramHydrateInFlight = false;
  let dropShoulderAutoForceRefreshDone = false;
  let dropShoulderWorkspaceQuickEditRevision = 0;

  const renderSummaryDiagramFromMerged = async (merged: Record<DiagramFieldKey, string>): Promise<void> => {
    const displayMerged = dropShoulderEditWorkspaceMergedForDiagram(merged);
    diagramInches = displayMerged;
    if (!(diagramHost instanceof HTMLElement)) return;

    const renderKey = `${JSON.stringify(displayMerged)}|${getDisplayUnit() ?? "in"}|${readOnly}`;
    const hasDiagram = !!diagramHost.querySelector(".express-mbp--diagram");
    if (renderKey === lastSummaryDiagramRenderKey && hasDiagram) {
      diagramUnitDisplayReady = true;
      if (unitDisplayActive) {
        applyDiagramUnitDisplay(diagramHost, diagramInches, readOnly, lastDisplayUnit);
      }
      if (!readOnly) refreshPatternValidationUi(root, getDisplayUnit());
      return;
    }
    lastSummaryDiagramRenderKey = renderKey;

    suppressDropShoulderSleeveUserEditTracking = true;
    try {
      lastDisplayUnit = getDisplayUnit() ?? "in";
      await renderDiagram(
        diagramHost,
        root,
        displayMerged,
        readOnly,
        unitDisplayActive ? lastDisplayUnit : null,
        getDisplayUnit,
      );
    } finally {
      suppressDropShoulderSleeveUserEditTracking = false;
    }
    diagramUnitDisplayReady = true;
    scheduleCaptureCustomPatternDirtyBaselineAfterHydration();
    if (unitDisplayActive) {
      const stats = applyDiagramUnitDisplay(diagramHost, diagramInches, readOnly, lastDisplayUnit);
      logReviewUnitDebug("diagram unit display", {
        unit: lastDisplayUnit,
        boxesFound: stats.boxesFound,
        suffixesUpdated: stats.suffixesUpdated,
        valuesUpdated: stats.valuesUpdated,
      });
    }
    if (!readOnly) refreshPatternValidationUi(root, getDisplayUnit());
  };

  const runDropShoulderWorkspaceRehydrate = async (
    _quickEditSizing: DropShoulderQuickEditSizing,
    _meta?: DropShoulderWorkspaceRehydrateMeta,
  ): Promise<boolean> => {
    if (!isDropShoulderWorkspaceMeasurementSummaryPage()) {
      return false;
    }
    const quickEditSizing = readDropShoulderWorkspaceQuickEditSizingFromDom();
    if (!quickEditSizing) return false;
    dropShoulderWorkspaceQuickEditRevision += 1;
    const revisionAtStart = dropShoulderWorkspaceQuickEditRevision;
    await loadExpressSweaterCharts();
    if (revisionAtStart !== dropShoulderWorkspaceQuickEditRevision) return false;

    if (diagramHost instanceof HTMLElement) {
      diagramHost.replaceChildren();
      diagramUnitDisplayReady = false;
      lastSummaryDiagramRenderKey = "";
    }

    const forced = forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing(quickEditSizing);
    if (!forced) return false;
    if (revisionAtStart !== dropShoulderWorkspaceQuickEditRevision) return false;

    const summaryCtx = readDropShoulderWorkspaceQuickEditSummaryFromDom(quickEditSizing);
    if (summaryEl instanceof HTMLElement) {
      renderBuildSummary(
        summaryEl,
        {
          who: summaryCtx.who,
          size: forced.selectedSize,
          garment: summaryCtx.garment,
          neckline: summaryCtx.neckline,
          fit: summaryCtx.fit,
          gauge: summaryCtx.gauge,
        },
        { preserveUnitsHost: options?.preserveUnitsHost === true },
      );
    }

    await renderSummaryDiagramFromMerged(forced.merged as Record<DiagramFieldKey, string>);
    return true;
  };

  dropShoulderWorkspaceRehydrateImpl = runDropShoulderWorkspaceRehydrate;

  const hydrateWorkspaceSummaryDiagram = async (): Promise<void> => {
    if (workspaceSummaryDiagramHydrateInFlight) {
      return;
    }
    workspaceSummaryDiagramHydrateInFlight = true;
    const hydrateRevisionAtStart = dropShoulderWorkspaceQuickEditRevision;
    try {
      const pattern = getCurrentPattern();
      const expressValues = readExpressValues();
      const fit = pattern.fit ?? {};
      const dropShoulderWorkspaceSummary = isDropShoulderWorkspaceMeasurementSummaryPage();
      const quickEditSizing = dropShoulderWorkspaceSummary
        ? readDropShoulderWorkspaceQuickEditSizingFromDom()
        : null;
      const patternSizing = dropShoulderWorkspaceSummary
        ? resolveDropShoulderSummarySizingFromPattern()
        : null;
      const audience =
        quickEditSizing?.audience ||
        patternSizing?.audience ||
        expressWhoToChartAudience(expressValues.who) ||
        expressWhoToChartAudience(fit.sizingChart) ||
        expressWhoToChartAudience(pattern.style?.recipientCategory);
      const size =
        quickEditSizing?.selectedSize ||
        patternSizing?.selectedSize ||
        (typeof expressValues.selectedSize === "string" && expressValues.selectedSize.trim()) ||
        (typeof fit.selectedSize === "string" && fit.selectedSize.trim()) ||
        "";
      const fitPref =
        quickEditSizing?.fitPreference ||
        patternSizing?.fitPreference ||
        resolveFitPreference(expressValues, fit);
      const row = audience && size ? findExpressChartRow(audience, size) : null;

      if (!row || !audience) {
        if (missingEl instanceof HTMLElement) missingEl.removeAttribute("hidden");
        if (diagramHost instanceof HTMLElement) {
          diagramHost.replaceChildren();
          lastSummaryDiagramRenderKey = "";
        }
        if (continueBtn instanceof HTMLButtonElement) continueBtn.disabled = true;
        diagramUnitDisplayReady = false;
        return;
      }

      let neckline = expressValues.neckline?.trim() ?? "";
      if (!neckline) {
        const canon = String(pattern.style?.neckline ?? "").trim().toLowerCase();
        if (canon === "v") neckline = "v-neck";
        else if (canon === "round") neckline = "round";
      }

      const garmentSummary = garmentStyleLabel(expressValues, pattern);
      const summaryContext =
        dropShoulderWorkspaceSummary && quickEditSizing
          ? readDropShoulderWorkspaceQuickEditSummaryFromDom(quickEditSizing)
          : {
              who: expressValues.who ?? "",
              size,
              garment: garmentSummary,
              neckline: necklineLabel(neckline),
              fit: fitPref,
              gauge: gaugeSummary(pattern),
            };
      if (summaryEl instanceof HTMLElement) {
        renderBuildSummary(
          summaryEl,
          {
            who: summaryContext.who,
            size: summaryContext.size,
            garment: summaryContext.garment,
            neckline: summaryContext.neckline,
            fit: summaryContext.fit,
            gauge: summaryContext.gauge,
          },
          { preserveUnitsHost: options?.preserveUnitsHost === true },
        );
      }

      const garmentStyle = resolveSleevelessGarmentKind({
        wizardGarmentType: readCustomBuildWizardGarmentType(),
        canonicalStyle: (pattern.style ?? {}) as Record<string, unknown>,
        patternBuilderStyle: (getPatternData().style ?? {}) as Record<string, unknown>,
        expressValues,
      }).garmentStyle;

      document.dispatchEvent(
        new CustomEvent(SLEEVELESS_REVIEW_CONTEXT_READY_EVENT, {
          detail: {
            who: expressValues.who ?? "",
            neckline: neckline === "v-neck" ? "v-neck" : "round",
            garmentStyle,
            chartAudience: audience,
            ...(size ? { selectedSize: size } : {}),
          },
        }),
      );

      if (missingEl instanceof HTMLElement) missingEl.setAttribute("hidden", "");
      if (continueBtn instanceof HTMLButtonElement) continueBtn.disabled = false;

      const bodyShape = dropShoulderWorkspaceSummary
        ? patternSizing?.bodyShape ?? mapExpressStyleKey(expressValues.style ?? "").bodyShape
        : undefined;

      if (
        dropShoulderWorkspaceSummary &&
        !dropShoulderAutoForceRefreshDone &&
        readDropShoulderReviewDiagramDirty() &&
        row &&
        audience &&
        size
      ) {
        dropShoulderAutoForceRefreshDone = true;
        if (diagramHost instanceof HTMLElement) {
          diagramHost.replaceChildren();
          diagramUnitDisplayReady = false;
          lastSummaryDiagramRenderKey = "";
        }
        const forced = quickEditSizing
          ? forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing(quickEditSizing)
          : forceRefreshDropShoulderSummaryMeasurements();
        if (forced) {
          await renderSummaryDiagramFromMerged(forced.merged as Record<DiagramFieldKey, string>);
          if (readOnly && options?.onContinue) {
            wireReadOnlyContinueToPattern(root, options.onContinue);
          }
          return;
        }
      }

      let merged: Record<DiagramFieldKey, string>;

      if (dropShoulderWorkspaceSummary && row && audience && size) {
        merged = buildDropShoulderReviewMergedInches({
          row,
          selectedSize: size,
          fitPreference: fitPref,
          audience,
          bodyShape,
        }) as Record<DiagramFieldKey, string>;
      } else {
        const defaults = computeDefaultsFromChart(row, fitPref, audience);
        merged = mergeOverridesWithDefaults(loadMeasurementOverrides(), defaults);
      }

      if (
        dropShoulderWorkspaceSummary &&
        hydrateRevisionAtStart !== dropShoulderWorkspaceQuickEditRevision
      ) {
        return;
      }

      await renderSummaryDiagramFromMerged(merged);

      if (dropShoulderWorkspaceSummary && row && audience && size) {
        commitDropShoulderReviewDiagramHydration(
          buildDropShoulderReviewDisplayIdentity(audience, size, fitPref),
        );
      }

      if (readOnly && options?.onContinue) {
        wireReadOnlyContinueToPattern(root, options.onContinue);
      }
    } finally {
      workspaceSummaryDiagramHydrateInFlight = false;
    }
  };

  dropShoulderWorkspaceSummaryRefreshImpl = async (): Promise<void> => {
    await loadExpressSweaterCharts();
    await hydrateWorkspaceSummaryDiagram();
  };

  // Edit workspace reopen / unit-reset: re-render the diagram from the saved draft so a discarded
  // unit switch or measurement edit never leaves a stale display behind (shared by both families).
  patternWorkspaceMeasurementDiagramRehydrateImpl = async (): Promise<void> => {
    diagramUnitDisplayReady = false;
    lastSummaryDiagramRenderKey = "";
    await loadExpressSweaterCharts();
    await hydrateWorkspaceSummaryDiagram();
  };

  void loadExpressSweaterCharts().then(hydrateWorkspaceSummaryDiagram);

  if (!isDropShoulderWorkspaceMeasurementSummaryPage()) {
    window.addEventListener("pageshow", (ev: Event) => {
      const pe = ev as PageTransitionEvent;
      if (!pe.persisted) return;
      diagramUnitDisplayReady = false;
      void loadExpressSweaterCharts().then(hydrateWorkspaceSummaryDiagram);
    });
  }
}

function shouldAutoInitCustomBuildMeasurementsPage(): boolean {
  const root = document.querySelector("[data-cb-measure-root]");
  if (!(root instanceof HTMLElement)) return false;
  return !root.hasAttribute("data-sleeveless-review-managed");
}

if (typeof document !== "undefined") {
  const boot = (): void => {
    if (!shouldAutoInitCustomBuildMeasurementsPage()) return;
    initCustomBuildMeasurementsPage();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
