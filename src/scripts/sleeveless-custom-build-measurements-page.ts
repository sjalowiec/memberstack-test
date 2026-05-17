/**
 * Custom Build — Measurements step (`/patterns/sleeveless/custom-build/fit/`).
 * Sleeveless body diagram with editable inches; values in `cbMeasurementOverrides` only.
 */
import { formatSwatchCountForGaugeInput } from "../lib/patterns/gaugeDisplayFormat";
import { getDefaultHemLengthInches } from "../lib/patterns/hemDefaults";
import { getCurrentPattern, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "../lib/patterns/patternStorage";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "../lib/patterns/sleevelessCustomMeasurementStorage";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";
import {
  computeDefaultMeasurementsFromChartRow,
  expressWhoToChartAudience,
  findExpressChartRow,
  loadExpressSweaterCharts,
  resolveExpressChartFit,
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
  "finishedLength",
  "hemDepth",
] as const;

type DiagramFieldKey = (typeof DIAGRAM_FIELD_KEYS)[number];

type DiagramFieldDef = {
  key: DiagramFieldKey;
  positionMod: string;
  label: string;
  labelLines?: string[];
  axis?: "horizontal" | "vertical";
  defaultInches: (row: ChartRow, computed: Record<string, number>, audience: string) => number | undefined;
};

const DIAGRAM_FIELDS: DiagramFieldDef[] = [
  {
    key: "finishedNeckOpeningWidth",
    positionMod: "neck-opening",
    label: "Neck opening",
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.neck_width, toFinite(row.neck_opening)),
  },
  {
    key: "neckDepth",
    positionMod: "neckline-depth",
    label: "Neck depth",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.front_neck_depth, toFinite(row.front_neck_depth)),
  },
  {
    key: "shoulderWidth",
    positionMod: "shoulder",
    label: "Shoulder width",
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.shoulder_width, toFinite(row.shoulder_width)),
  },
  {
    key: "armholeDepth",
    positionMod: "armhole",
    label: "Armhole depth",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.armhole_depth, toFinite(row.armhole_depth)),
  },
  {
    key: "chestBust",
    positionMod: "finished-bust",
    label: "Finished bust (ease)",
    labelLines: ["Finished", "bust (ease)"],
    axis: "horizontal",
    defaultInches: (row, computed) =>
      pickPositive(computed.finished_bust_chest, toFinite(row.bust_or_chest)),
  },
  {
    key: "finishedLength",
    positionMod: "back-length",
    label: "Garment length",
    axis: "vertical",
    defaultInches: (row, computed) =>
      pickPositive(computed.back_neck_to_hem, toFinite(row.garment_back_length)),
  },
  {
    key: "hemDepth",
    positionMod: "ribbed-hem-depth",
    label: "Ribbed hem depth",
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
  svg.querySelector("#line-hem-width")?.setAttribute("visibility", "hidden");
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
  const pbGarment = String(style.garmentStyle ?? "").trim().toLowerCase();
  const pbOpen = String(style.frontStyle ?? "").trim().toLowerCase() === "open";
  const lsFront = String(expressValues.front ?? "").trim().toLowerCase();
  const styleKey = String(expressValues.style ?? "").trim().toLowerCase();
  const isCardigan =
    pbGarment === "cardigan" ||
    pbOpen ||
    lsFront === "open" ||
    styleKey.includes("cardigan");
  const base = isCardigan ? "Cardigan" : "Pullover";
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
  value: string,
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
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.className = "express-mbp-box__input";
  input.setAttribute("data-cb-measure-input", field.key);
  input.setAttribute("aria-label", `${field.label} in inches`);
  input.value = value;
  const unit = document.createElement("span");
  unit.className = "express-mbp-box__unit";
  unit.textContent = "in";
  fieldRow.append(input, unit);

  const err = document.createElement("span");
  err.className = "express-mbp-box__error";
  err.setAttribute("data-cb-measure-error", field.key);
  err.hidden = true;

  box.append(lab, fieldRow, err);
  return box;
}

function formatReadonlyInchesDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  const n = parseInchesInput(trimmed);
  if (n === undefined) return trimmed;
  return `${formatSwatchCountForGaugeInput(n)} in`;
}

function createDiagramReadonlyFieldBox(
  field: DiagramFieldDef,
  value: string,
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
  valEl.textContent = formatReadonlyInchesDisplay(value);

  box.append(lab, valEl);
  return box;
}

function collectValues(root: HTMLElement): Record<DiagramFieldKey, string> {
  const out = {} as Record<DiagramFieldKey, string>;
  for (const key of DIAGRAM_FIELD_KEYS) {
    const input = root.querySelector<HTMLInputElement>(`[data-cb-measure-input="${key}"]`);
    out[key] = input?.value.trim() ?? "";
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

function validateFields(root: HTMLElement): boolean {
  clearAllFieldErrors(root);
  let ok = true;
  const values = collectValues(root);
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

function persistFromRoot(root: HTMLElement): void {
  const values = collectValues(root);
  const toStore: Record<string, string> = {};
  for (const key of DIAGRAM_FIELD_KEYS) {
    const n = parseInchesInput(values[key]);
    if (n !== undefined) toStore[key] = formatInchesInput(n);
  }
  persistMeasurementOverrides(toStore);
}

function buildValidationInputFromRoot(root: HTMLElement): ReturnType<typeof buildSleevelessCustomBuildValidationInput> {
  const values = collectValues(root);
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

function refreshPatternValidationUi(root: HTMLElement): boolean {
  const validationHost = root.querySelector("[data-cb-pattern-validation]");
  const continueBtn = root.querySelector("[data-cb-measure-continue]");
  if (!(validationHost instanceof HTMLElement)) return true;

  const messages = validateSleevelessPatternInputs(buildValidationInputFromRoot(root));
  const { errors } = renderCbMeasureValidationOverlay(validationHost, messages, {
    warningsDismissed: cbMeasureWarningsDismissed,
    onDismissWarnings: () => {
      cbMeasureWarningsDismissed = true;
      refreshPatternValidationUi(root);
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

function wireFieldPersistence(root: HTMLElement): void {
  root.querySelectorAll("[data-cb-measure-input]").forEach((el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const save = (): void => {
      resetCbMeasureWarningDismissal();
      const key = el.getAttribute("data-cb-measure-input") as DiagramFieldKey | null;
      if (!key) return;
      const n = parseInchesInput(el.value);
      if (el.value.trim() && n === undefined) {
        setFieldError(root, key, "Enter a positive number");
        refreshPatternValidationUi(root);
        return;
      }
      setFieldError(root, key, null);
      el.closest(".express-mbp-box")?.classList.remove("express-mbp-box--invalid");
      persistFromRoot(root);
      refreshPatternValidationUi(root);
    };
    el.addEventListener("change", save);
    el.addEventListener("blur", save);
    el.addEventListener("input", () => {
      resetCbMeasureWarningDismissal();
      refreshPatternValidationUi(root);
    });
  });
}

function wireReadOnlyContinueToPattern(root: HTMLElement, onContinue: () => void): void {
  const existing = root.querySelector("[data-express-measurements-continue]");
  if (!(existing instanceof HTMLAnchorElement)) return;
  const anchor = existing.cloneNode(true) as HTMLAnchorElement;
  existing.replaceWith(anchor);
  anchor.href = PATTERN_WORKSPACE_TAB_PATTERN_HREF;
  anchor.removeAttribute("hidden");
  anchor.addEventListener("click", (ev: MouseEvent) => {
    ev.preventDefault();
    onContinue();
  });
}

async function renderDiagram(
  diagramHost: HTMLElement,
  pageRoot: HTMLElement,
  merged: Record<DiagramFieldKey, string>,
  readOnly: boolean,
): Promise<void> {
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
        ? createDiagramReadonlyFieldBox(field, merged[field.key] ?? "", boxOpts)
        : createDiagramFieldBox(field, merged[field.key] ?? "", boxOpts),
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
  if (!readOnly) wireFieldPersistence(pageRoot);
}

export function initCustomBuildMeasurementsPage(options?: CustomBuildMeasurementsInitOptions): void {
  const root = document.querySelector("[data-cb-measure-root]");
  if (!(root instanceof HTMLElement)) return;

  const readOnly = options?.readOnly === true;
  const summaryEl = root.querySelector("[data-cb-build-summary]");
  const missingEl = root.querySelector("[data-cb-measure-missing]");
  const diagramHost = root.querySelector("[data-cb-measure-diagram]");
  const continueBtn = root.querySelector("[data-cb-measure-continue]");

  if (!readOnly) {
    continueBtn?.addEventListener("click", () => {
      if (!validateFields(root)) return;
      if (!refreshPatternValidationUi(root)) return;
      persistFromRoot(root);
      syncCustomBuildToPatternStorage({ awaitCharts: false });
      if (options?.onContinue) {
        options.onContinue();
        return;
      }
      window.location.assign(options?.continueHref ?? YARN_GAUGE_HREF);
    });
  }

  void loadExpressSweaterCharts().then(async () => {
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

    const style = pattern.style ?? {};
    const lsFront = String(expressValues.front ?? "").trim().toLowerCase();
    const styleKey = String(expressValues.style ?? "").trim().toLowerCase();
    const pbGarment = String(style.garmentStyle ?? "").trim().toLowerCase() === "cardigan";
    const pbOpen = String(style.frontStyle ?? "").trim().toLowerCase() === "open";
    const garmentStyle: "pullover" | "cardigan" =
      pbGarment || pbOpen || lsFront === "open" || styleKey.includes("cardigan")
        ? "cardigan"
        : "pullover";

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

    if (diagramHost instanceof HTMLElement) {
      await renderDiagram(diagramHost, root, merged, readOnly);
      if (!readOnly) refreshPatternValidationUi(root);
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
