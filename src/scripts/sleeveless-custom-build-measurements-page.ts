/**
 * Custom Build — Measurements step (`/patterns/sleeveless/custom-build/fit/`).
 * Sleeveless body diagram with editable inches; values in `cbMeasurementOverrides` only.
 */
import { formatSwatchCountForGaugeInput } from "../lib/patterns/gaugeDisplayFormat";
import { getDefaultHemLengthInches } from "../lib/patterns/hemDefaults";
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
  logCustomBuildGarmentHandoff,
  logGarmentTypeRaw,
  logSummaryGarmentRead,
} from "../lib/patterns/customBuildGarmentHandoffDebug";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";
import {
  computeDefaultMeasurementsFromChartRow,
  expressWhoToChartAudience,
  findExpressChartRow,
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
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS,
} from "../lib/patterns/patternSummaryMeasurementOverlay";

const MEASUREMENT_BLUEPRINT_SVG_URL = "/images/patterns/pattern_summary.svg";
const YARN_GAUGE_HREF = "/patterns/sleeveless/custom-build/yarn-gauge";
const PATTERN_WORKSPACE_TAB_PATTERN_HREF = "/patterns/sleeveless/pattern/?tab=pattern";

export type CustomBuildMeasurementsInitOptions = {
  /** When set, Continue navigates here instead of Custom Build yarn & gauge. */
  continueHref?: string;
  /** When set, runs after validation + persist instead of default navigation. */
  onContinue?: () => void;
  /** When true, diagram fields are read-only (unified review for free users). */
  readOnly?: boolean;
  /** Keep unit toggle in summary host when rendering build summary (unified review). */
  preserveUnitsHost?: boolean;
};

/** Sleeveless body fields shown on the diagram (inches, stored as decimal strings). */
const DIAGRAM_FIELD_KEYS = [
  "finishedNeckOpeningWidth",
  "neckDepth",
  "shoulderWidth",
  "armholeDepth",
  "chestBust",
  "hip",
  "finishedLength",
  "hemDepth",
] as const;

type DiagramFieldKey = (typeof DIAGRAM_FIELD_KEYS)[number];

type DiagramFieldDef = {
  key: DiagramFieldKey;
  positionMod: string;
  targetId: string;
  /** Optional CSS transform for anchor alignment (e.g. hem chip above target). */
  anchorTransform?: string;
  label: string;
  labelLines?: string[];
  axis?: "horizontal" | "vertical";
  defaultInches: (row: ChartRow, computed: Record<string, number>, audience: string) => number | undefined;
};

const DIAGRAM_FIELDS: DiagramFieldDef[] = [
  {
    key: "finishedNeckOpeningWidth",
    positionMod: "neck-opening",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
    label: "Neck opening",
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.neck_width, toFinite(row.neck_opening)),
  },
  {
    key: "neckDepth",
    positionMod: "neckline-depth",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
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
    label: "Armhole depth",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.armhole_depth, toFinite(row.armhole_depth)),
  },
  {
    key: "chestBust",
    positionMod: "finished-bust",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.bust,
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
    label: "Garment length",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.back_neck_to_hem, toFinite(row.garment_back_length)),
  },
  {
    key: "hemDepth",
    positionMod: "ribbed-hem-depth",
    targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.hem,
    anchorTransform: "translate(-50%, -100%)",
    label: "Hem depth",
    axis: "vertical",
    defaultInches: (_row, _computed, audience) => getDefaultHemLengthInches(audience),
  },
];

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

type UiLengthUnit = "in" | "cm";

function inchesToCmRounded(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

/** Display-only: stored inches → input/value text for the active UI unit. */
function formatMeasurementDisplayFromInches(
  inches: number | undefined,
  unit: UiLengthUnit,
): string {
  if (inches === undefined || !Number.isFinite(inches)) return "";
  if (unit === "cm") return String(inchesToCmRounded(inches));
  return formatInchesInput(inches);
}

/** Display-only: stored inch string → readonly chip text. */
function formatReadonlyMeasurementDisplay(rawInches: string, unit: UiLengthUnit): string {
  const trimmed = rawInches.trim();
  if (!trimmed) return "—";
  const inches = parseInchesInput(trimmed);
  if (inches === undefined) return trimmed;
  if (unit === "cm") return `${inchesToCmRounded(inches)} cm`;
  return `${formatSwatchCountForGaugeInput(inches)} in`;
}

/** Parse visible field text in the active UI unit; returns stored inches. */
function parseMeasurementInputToInches(raw: string, unit: UiLengthUnit): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const inches = unit === "cm" ? n / 2.54 : n;
  return roundQuarter(inches);
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
  for (const key of DIAGRAM_FIELD_KEYS) {
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
  try {
    const res = await fetch(MEASUREMENT_BLUEPRINT_SVG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svgText = await res.text();
    const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const root = parsed.documentElement;
    if (!(root instanceof SVGSVGElement)) throw new Error("not an SVG root");
    applyExpressMeasurementBlueprintSvgDisplay(root);
    const svg = document.importNode(root, true);
    if (!(svg instanceof SVGSVGElement)) throw new Error("import failed");
    svg.classList.add("express-mbp-art");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Sleeveless sweater body measurement diagram");
    svg.setAttribute("focusable", "false");
    return svg;
  } catch {
    const img = document.createElement("img");
    img.className = "express-mbp-art";
    img.src = MEASUREMENT_BLUEPRINT_SVG_URL;
    img.width = 142;
    img.height = 195;
    img.alt = "Sleeveless sweater body measurement diagram";
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
  const spi = yarnG?.stitchGauge ?? yarnM?.gaugeStitchesPerInch;
  const rpi = yarnG?.rowGauge ?? yarnM?.gaugeRowsPerInch;
  if (spi != null && rpi != null && String(spi).trim() && String(rpi).trim()) {
    return `${spi} sts × ${rpi} rows / inch`;
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
  applyMeasurementTargetToBox(box, field.targetId, {
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
  applyMeasurementTargetToBox(box, field.targetId, {
    transform: field.anchorTransform,
  });
  return box;
}

let diagramOverlayPositionCleanup: (() => void) | null = null;

function collectValues(
  root: HTMLElement,
  options?: { displayUnit?: UiLengthUnit | null },
): Record<DiagramFieldKey, string> {
  const displayUnit = options?.displayUnit;
  const out = {} as Record<DiagramFieldKey, string>;
  for (const key of DIAGRAM_FIELD_KEYS) {
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
  for (const key of DIAGRAM_FIELD_KEYS) setFieldError(root, key, null);
}

function validateFields(root: HTMLElement, displayUnit: UiLengthUnit | null): boolean {
  clearAllFieldErrors(root);
  let ok = true;
  const values = collectValues(root, { displayUnit });
  for (const key of DIAGRAM_FIELD_KEYS) {
    const raw = values[key];
    if (!raw) {
      setFieldError(root, key, "Required");
      ok = false;
      continue;
    }
    if (parseInchesInput(raw) === undefined) {
      setFieldError(root, key, "Enter a positive number");
      ok = false;
    }
  }
  return ok;
}

function persistFromRoot(root: HTMLElement, displayUnit: UiLengthUnit | null): void {
  const values = collectValues(root, { displayUnit });
  const toStore: Record<string, string> = {};
  for (const key of DIAGRAM_FIELD_KEYS) {
    const n = parseInchesInput(values[key]);
    if (n !== undefined) toStore[key] = formatInchesInput(n);
  }
  persistMeasurementOverrides(toStore);
}

function buildValidationInputFromRoot(
  root: HTMLElement,
  displayUnit: UiLengthUnit | null,
): ReturnType<typeof buildSleevelessCustomBuildValidationInput> {
  const values = collectValues(root, { displayUnit });
  const overrides: Record<string, string> = {};
  for (const key of DIAGRAM_FIELD_KEYS) {
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

function wireFieldPersistence(root: HTMLElement, getDisplayUnit: () => UiLengthUnit | null): void {
  root.querySelectorAll("[data-cb-measure-input]").forEach((el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const save = (): void => {
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
      persistFromRoot(root, displayUnit);
      refreshPatternValidationUi(root, displayUnit);
    };
    el.addEventListener("change", save);
    el.addEventListener("blur", save);
    el.addEventListener("input", () => {
      resetCbMeasureWarningDismissal();
      refreshPatternValidationUi(root, getDisplayUnit());
    });
  });
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

  for (const field of DIAGRAM_FIELDS) {
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

  for (const field of DIAGRAM_FIELDS) {
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
    const anchors = collectOverlayAnchors(overlay);
    diagramOverlayPositionCleanup = bindPatternSummaryOverlayPositioning(
      inner,
      art,
      overlay,
      anchors,
    );
  }

  if (!readOnly) wireFieldPersistence(pageRoot, getDisplayUnit);
}

export function initCustomBuildMeasurementsPage(options?: CustomBuildMeasurementsInitOptions): void {
  logGarmentTypeRaw("[kbm summary first read]");
  const root = document.querySelector("[data-cb-measure-root]");
  if (!(root instanceof HTMLElement)) return;

  const readOnly = options?.readOnly === true;
  const useUiUnitDisplay = options?.preserveUnitsHost === true;
  const summaryEl = root.querySelector("[data-cb-build-summary]");
  const missingEl = root.querySelector("[data-cb-measure-missing]");
  const diagramHost = root.querySelector("[data-cb-measure-diagram]");
  const continueBtn = root.querySelector("[data-cb-measure-continue]");

  const getDisplayUnit = (): UiLengthUnit | null => (useUiUnitDisplay ? getExpressUiUnit() : null);
  let diagramInches = {} as Record<DiagramFieldKey, string>;
  let lastDisplayUnit: UiLengthUnit = useUiUnitDisplay ? getExpressUiUnit() : "in";
  let diagramUnitDisplayReady = false;

  if (useUiUnitDisplay) {
    const onReviewUnitsChange = (ev: Event): void => {
      const ce = ev as CustomEvent<{ unit?: string; toggleId?: string }>;
      const toggleId = ce.detail?.toggleId;
      if (toggleId != null && toggleId !== SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID) {
        logReviewUnitDebug("ignored: other toggle", { toggleId });
        return;
      }

      const unit: UiLengthUnit = ce.detail?.unit === "cm" ? "cm" : "in";
      logReviewUnitDebug("kbm:units-change received", {
        event: "kbm:units-change",
        unit,
        toggleId: toggleId ?? SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
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
      toggleId: SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
    });
  }

  if (!readOnly) {
    continueBtn?.addEventListener("click", () => {
      const displayUnit = getDisplayUnit();
      if (!validateFields(root, displayUnit)) return;
      if (!refreshPatternValidationUi(root, displayUnit)) return;
      persistFromRoot(root, displayUnit);
      syncCustomBuildToPatternStorage({ awaitCharts: false });
      logCustomBuildGarmentHandoff("review/measurements Continue (after sync)");
      if (options?.onContinue) {
        options.onContinue();
        return;
      }
      window.location.assign(options?.continueHref ?? YARN_GAUGE_HREF);
    });
  }

  void loadExpressSweaterCharts().then(async () => {
    syncCustomBuildToPatternStorage({ awaitCharts: false });
    logSummaryGarmentRead("measurements/review page (after sync, before label)");
    const pattern = getCurrentPattern();
    const expressValues = readExpressValues();
    const fit = pattern.fit ?? {};
    const audience =
      expressWhoToChartAudience(expressValues.who) ||
      expressWhoToChartAudience(fit.sizingChart) ||
      expressWhoToChartAudience(pattern.style?.recipientCategory);
    const size =
      (typeof expressValues.selectedSize === "string" && expressValues.selectedSize.trim()) ||
      (typeof fit.selectedSize === "string" && fit.selectedSize.trim()) ||
      "";
    const fitPref = resolveFitPreference(expressValues, fit);
    const row = audience && size ? findExpressChartRow(audience, size) : null;

    let neckline = expressValues.neckline?.trim() ?? "";
    if (!neckline) {
      const canon = String(pattern.style?.neckline ?? "").trim().toLowerCase();
      if (canon === "v") neckline = "v-neck";
      else if (canon === "round") neckline = "round";
    }

    const garmentSummary = garmentStyleLabel(expressValues, pattern);
    if (summaryEl instanceof HTMLElement) {
      renderBuildSummary(
        summaryEl,
        {
          who: expressValues.who ?? "",
          size,
          garment: garmentSummary,
          neckline: necklineLabel(neckline),
          fit: fitPref,
          gauge: gaugeSummary(pattern),
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

    if (!row || !audience) {
      if (missingEl instanceof HTMLElement) missingEl.removeAttribute("hidden");
      if (diagramHost instanceof HTMLElement) diagramHost.replaceChildren();
      if (continueBtn instanceof HTMLButtonElement) continueBtn.disabled = true;
      return;
    }

    if (missingEl instanceof HTMLElement) missingEl.setAttribute("hidden", "");
    if (continueBtn instanceof HTMLButtonElement) continueBtn.disabled = false;

    const defaults = computeDefaultsFromChart(row, fitPref, audience);
    const saved = loadMeasurementOverrides();
    const merged = mergeOverridesWithDefaults(saved, defaults);
    diagramInches = merged;

    if (diagramHost instanceof HTMLElement) {
      lastDisplayUnit = useUiUnitDisplay ? getExpressUiUnit() : "in";
      await renderDiagram(
        diagramHost,
        root,
        merged,
        readOnly,
        useUiUnitDisplay ? lastDisplayUnit : null,
        getDisplayUnit,
      );
      diagramUnitDisplayReady = true;
      if (useUiUnitDisplay) {
        const stats = applyDiagramUnitDisplay(diagramHost, diagramInches, readOnly, lastDisplayUnit);
        logReviewUnitDebug("initial diagram unit display", {
          unit: lastDisplayUnit,
          boxesFound: stats.boxesFound,
          suffixesUpdated: stats.suffixesUpdated,
          valuesUpdated: stats.valuesUpdated,
        });
      }
      if (!readOnly) refreshPatternValidationUi(root, getDisplayUnit());
    }

    if (readOnly && options?.onContinue) {
      wireReadOnlyContinueToPattern(root, options.onContinue);
    }
  });
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
