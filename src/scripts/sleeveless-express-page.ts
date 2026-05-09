/**
 * Express Pattern wizard (/patterns/sleeveless-express): accordion steps + shared GaugeInput (ids express-stitch-gauge / express-row-gauge).
 */
import { initPatternTabs } from "../lib/patterns/patternTabsClient";
import {
  saveCurrentPattern,
  savePatternData,
  getPatternData,
  normalizeSleevelessAudience,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "../lib/patterns/patternStorage";
import {
  bodyMeasurementInchesToCmRounded,
  formatBodyMeasurementInchesForLabel,
  pickBodyBustChestCmFromRow,
} from "../lib/patterns/sizingDisplay";

/** Mirrors Fit step chart JSON rows (same as SleevelessGarmentFitStep). */
type ChartRow = {
  size?: unknown;
  bust_or_chest?: unknown;
  waist?: unknown;
  garment_back_length?: unknown;
  armhole_depth?: unknown;
  shoulder_width?: unknown;
  neck_opening?: unknown;
  front_neck_depth?: unknown;
  back_neck_depth?: unknown;
};

const STEPS = 5;
const LOCKED_STEP_NAV_TITLE = "Finish the previous step to continue.";

const CHART_AUDIENCES = ["misses", "plus", "men", "kids", "baby"] as const;

/** Populated after {@link loadExpressSweaterCharts}; same JSON as Fit step. */
const chartRowsByAudience: Record<string, ChartRow[]> = {};
const chartSizeSets: Record<string, Set<string>> = {};
let expressChartsLoadPromise: Promise<void> | null = null;

const LABELS: Record<string, Record<string, string>> = {
  who: { women: "Women", men: "Men", kids: "Kids", baby: "Baby" },
  neckline: { round: "Round", "v-neck": "V-neck" },
  fit: { close: "Close", standard: "Standard", relaxed: "Relaxed" },
};

/** Same labels as SleevelessGarmentDesignStep shape + front cards (summary line). */
const EXPRESS_SUMMARY_SHAPE: Record<string, string> = {
  straight: "Straight",
  aline: "A-line",
  waist: "Waist Shaped",
};
const EXPRESS_SUMMARY_FRONT: Record<string, string> = {
  closed: "Pullover",
  open: "Cardigan",
};

/** Shape card previews: pullover row uses silhouette SVGs; cardigan row uses front-opening variants. */
const EXPRESS_SHAPE_PREVIEW_PULLOVER: Record<string, string> = {
  straight: "/images/patterns/sleeveless/shape-straight.svg",
  aline: "/images/patterns/sleeveless/shape-aline.svg",
  waist: "/images/patterns/sleeveless/shape-fitted.svg",
};
const EXPRESS_SHAPE_PREVIEW_CARDIGAN: Record<string, string> = {
  straight: "/images/patterns/sleeveless/cardigan-straight.svg",
  aline: "/images/patterns/sleeveless/cardigan-a-line.svg",
  waist: "/images/patterns/sleeveless/cardigan-fitted.svg",
};

const GAUGE_STITCH_ID = "express-stitch-gauge";
const GAUGE_ROW_ID = "express-row-gauge";

/** Same sweater chart URLs as Fit step — used to apply middle-chart defaults so pattern validation can pass. */
const SWEATER_CHART_URLS: Record<string, string> = {
  misses: "/data/sizing_sweaters_misses.json",
  plus: "/data/sizing_sweaters_plus.json",
  men: "/data/sizing_sweaters_men.json",
  kids: "/data/sizing_sweaters_kids.json",
  baby: "/data/sizing_sweaters_baby.json",
};

const EASE_INCHES_BY_FIT: Record<string, number> = {
  close: 1,
  standard: 3,
  relaxed: 5,
};

/** Express patterns assume a standard 200-needle machine unless customized. */
const EXPRESS_DEFAULT_AVAILABLE_NEEDLES = "200";

function resolveExpressAvailableNeedles(
  prevYarnGaugeMachine: Record<string, unknown> | undefined,
): string {
  const raw = prevYarnGaugeMachine?.availableNeedles;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }
  return EXPRESS_DEFAULT_AVAILABLE_NEEDLES;
}

function getExpressGaugeUnit(): "cm" | "in" {
  const hidden = document.getElementById("unit");
  if (hidden instanceof HTMLInputElement && hidden.value === "cm") return "cm";
  if (hidden instanceof HTMLInputElement && hidden.value === "in") return "in";
  const cmBtn = document.getElementById("sleeveless-btn-cm");
  return cmBtn?.classList.contains("active") ? "cm" : "in";
}

function rawSwatchToPerInch(stitchRaw: string, rowRaw: string, unit: "cm" | "in") {
  const s = parseFloat(String(stitchRaw).trim());
  const r = parseFloat(String(rowRaw).trim());
  let gaugeStitchesPerInch = "";
  let gaugeRowsPerInch = "";
  if (unit === "cm") {
    if (Number.isFinite(s) && s > 0) gaugeStitchesPerInch = String((s / 10) * 2.54);
    if (Number.isFinite(r) && r > 0) gaugeRowsPerInch = String((r / 10) * 2.54);
  } else {
    if (Number.isFinite(s) && s > 0) gaugeStitchesPerInch = String(s / 4);
    if (Number.isFinite(r) && r > 0) gaugeRowsPerInch = String(r / 4);
  }
  return { gaugeStitchesPerInch, gaugeRowsPerInch };
}

function mapExpressStyle(styleKey: string) {
  switch (styleKey) {
    case "straight-pullover":
      return { bodyShape: "straight", frontStyle: "closed" as const };
    case "shaped-pullover":
      return { bodyShape: "aline", frontStyle: "closed" as const };
    case "straight-cardigan":
      return { bodyShape: "straight", frontStyle: "open" as const };
    case "shaped-cardigan":
      return { bodyShape: "aline", frontStyle: "open" as const };
    case "waist-pullover":
      return { bodyShape: "waist", frontStyle: "closed" as const };
    case "waist-cardigan":
      return { bodyShape: "waist", frontStyle: "open" as const };
    default:
      return { bodyShape: "straight", frontStyle: "closed" as const };
  }
}

/** Canonical Express style key from Custom Builder–aligned shape + front picks. */
function deriveExpressStyleKey(shape?: string, front?: string): string {
  if (!shape || !front) return "";
  if (shape === "straight" && front === "closed") return "straight-pullover";
  if (shape === "aline" && front === "closed") return "shaped-pullover";
  if (shape === "straight" && front === "open") return "straight-cardigan";
  if (shape === "aline" && front === "open") return "shaped-cardigan";
  if (shape === "waist" && front === "closed") return "waist-pullover";
  if (shape === "waist" && front === "open") return "waist-cardigan";
  return "";
}

/** Hydrate shape/front from legacy persisted `style` single-field sessions. */
function migrateExpressStyleFields(v: Record<string, string>): void {
  if (v.shape && v.front) {
    const derived = deriveExpressStyleKey(v.shape, v.front);
    if (derived) v.style = derived;
    return;
  }
  const s = v.style;
  if (!s) return;
  const legacy: Record<string, [string, string]> = {
    "straight-pullover": ["straight", "closed"],
    "shaped-pullover": ["aline", "closed"],
    "straight-cardigan": ["straight", "open"],
    "shaped-cardigan": ["aline", "open"],
    "waist-pullover": ["waist", "closed"],
    "waist-cardigan": ["waist", "open"],
  };
  const pair = legacy[s];
  if (pair) {
    v.shape = pair[0];
    v.front = pair[1];
  }
}

/** Free Express: V-neck is Custom Pattern only — normalize persisted sessions that predate the rule. */
function migrateExpressNecklineExpressFree(v: Record<string, string>): void {
  if (v.neckline === "v-neck") v.neckline = "round";
}

function expressStyleStepComplete(v: Record<string, string>): boolean {
  return v.shape === "straight" && v.front === "closed";
}

function mapExpressNeckline(n: string) {
  return n === "v-neck" ? "v" : "round";
}

function isValidPositiveNumber(v: string) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0 && Number.isFinite(n);
}

function toFiniteNumber(v: unknown): number {
  if (v === undefined || v === null) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function roundQuarter(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 4) / 4;
}

function easeInchesForFit(fitPreference: string): number {
  const e = EASE_INCHES_BY_FIT[fitPreference];
  return typeof e === "number" ? e : EASE_INCHES_BY_FIT.standard;
}

function normalizeChartRowSize(row: ChartRow): string {
  if (row.size === undefined || row.size === null) return "";
  return String(row.size);
}

function computeDefaultMeasurementsFromChartRow(row: ChartRow, fitPreference: string): Record<string, number> {
  const ease = easeInchesForFit(fitPreference);
  const bust = toFiniteNumber(row.bust_or_chest);
  const waist = toFiniteNumber(row.waist);
  const finishedBustChest = roundQuarter(bust + ease);
  return {
    finished_bust_chest: finishedBustChest,
    finished_waist: roundQuarter(waist + ease),
    finished_hip: finishedBustChest,
    back_neck_to_hem: roundQuarter(toFiniteNumber(row.garment_back_length)),
    armhole_depth: roundQuarter(toFiniteNumber(row.armhole_depth)),
    shoulder_width: roundQuarter(toFiniteNumber(row.shoulder_width)),
    neck_width: roundQuarter(toFiniteNumber(row.neck_opening)),
    front_neck_depth: roundQuarter(toFiniteNumber(row.front_neck_depth)),
    back_neck_depth: roundQuarter(toFiniteNumber(row.back_neck_depth)),
  };
}

function nonEmptyTrimmed(s: unknown): boolean {
  return typeof s === "string" && s.trim() !== "";
}

/** Same hidden `#unit` input + `kbm-units` fallback as SleevelessGarmentFitStep. */
function getExpressUiUnit(): "in" | "cm" {
  const hidden = document.getElementById("unit");
  if (hidden instanceof HTMLInputElement && (hidden.value === "in" || hidden.value === "cm")) {
    return hidden.value;
  }
  try {
    const u = localStorage.getItem("kbm-units");
    if (u === "in" || u === "cm") return u;
  } catch {
    /* ignore */
  }
  return "in";
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Table cell — same inches/cm rules as Fit dropdown labels. */
function formatBustChestDisplay(row: ChartRow, uiUnit: "in" | "cm"): string {
  const rowObj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  if (uiUnit === "cm") {
    let cm = pickBodyBustChestCmFromRow(rowObj);
    if (cm === null) {
      const inches = toFiniteNumber(row.bust_or_chest);
      cm = Number.isFinite(inches) ? bodyMeasurementInchesToCmRounded(inches) : null;
    }
    return cm !== null ? `${cm} cm` : "—";
  }
  const inches = toFiniteNumber(row.bust_or_chest);
  if (!Number.isFinite(inches)) return "—";
  return `${formatBodyMeasurementInchesForLabel(inches)}"`;
}

function findExpressChartRow(audience: string, sizeStr: string): ChartRow | null {
  const list = chartRowsByAudience[audience];
  if (!Array.isArray(list)) return null;
  const key = String(sizeStr);
  return list.find((row) => normalizeChartRowSize(row) === key) ?? null;
}

function isValidExpressSizeForAudience(audience: string, size: unknown): boolean {
  if (!audience || size === undefined || size === null || size === "") return false;
  const set = chartSizeSets[audience];
  return set instanceof Set && set.has(String(size));
}

/** Loads all sweater charts once (same URLs as Fit step). */
function loadExpressSweaterCharts(): Promise<void> {
  if (expressChartsLoadPromise) return expressChartsLoadPromise;
  expressChartsLoadPromise = (async () => {
    await Promise.all(
      CHART_AUDIENCES.map(async (aud) => {
        const url = SWEATER_CHART_URLS[aud];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${aud}: ${res.status}`);
        const rows = (await res.json()) as unknown;
        const list = Array.isArray(rows) ? (rows as ChartRow[]) : [];
        chartSizeSets[aud] = new Set();
        chartRowsByAudience[aud] = list;
        list.forEach((row) => {
          const k = normalizeChartRowSize(row);
          if (k) chartSizeSets[aud]!.add(k);
        });
      }),
    );
  })().catch((err) => {
    expressChartsLoadPromise = null;
    throw err;
  });
  return expressChartsLoadPromise;
}

function resolveExpressChartFit(
  chartAudience: string,
  sizeStr: string,
  fitPreference: string,
): { selectedSize: string; selectedMeasurements: Record<string, number> } | null {
  const row = findExpressChartRow(chartAudience, sizeStr);
  if (!row) return null;
  const selectedSize = normalizeChartRowSize(row);
  if (!selectedSize) return null;
  return {
    selectedSize,
    selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, fitPreference),
  };
}

/**
 * Writes Express UI selections into canonical sleeveless pattern storage (and patternBuilderData mirrors)
 * so the Custom Builder can hydrate fit, gauge, and pattern output.
 */
function syncExpressSelectionsToBuilderStorage(
  values: Record<string, string>,
  chartFit: { selectedSize: string; selectedMeasurements: Record<string, number> } | null = null,
) {
  const prevMachine =
    (getPatternData().yarnGaugeMachine as Record<string, unknown> | undefined) ?? {};
  const stitchEl = document.getElementById(GAUGE_STITCH_ID);
  const rowEl = document.getElementById(GAUGE_ROW_ID);
  const unit = getExpressGaugeUnit();
  const gaugeStitchRaw =
    stitchEl instanceof HTMLInputElement ? stitchEl.value.trim() : "";
  const gaugeRowRaw = rowEl instanceof HTMLInputElement ? rowEl.value.trim() : "";

  const hasBothGauge =
    isValidPositiveNumber(gaugeStitchRaw) && isValidPositiveNumber(gaugeRowRaw);
  const { gaugeStitchesPerInch, gaugeRowsPerInch } = hasBothGauge
    ? rawSwatchToPerInch(gaugeStitchRaw, gaugeRowRaw, unit)
    : { gaugeStitchesPerInch: "", gaugeRowsPerInch: "" };

  const stylePayload: Record<string, string> = {};
  const fitPayload: Record<string, unknown> = {};

  if (values.who) {
    const aud = normalizeSleevelessAudience(values.who) || "misses";
    stylePayload.recipientCategory = aud;
    fitPayload.sizingChart = aud;
  }
  if (values.style) {
    const sm = mapExpressStyle(values.style);
    stylePayload.bodyShape = sm.bodyShape;
    stylePayload.frontStyle = sm.frontStyle;
    stylePayload.length = "top";
    stylePayload.armholeStyle = "standard";
  }
  if (values.neckline) {
    stylePayload.neckline = mapExpressNeckline(values.neckline);
  }
  if (values.fit) {
    fitPayload.easeChoice = values.fit;
    fitPayload.fitChoice = values.fit;
  }
  if (chartFit) {
    fitPayload.selectedSize = chartFit.selectedSize;
    fitPayload.selectedMeasurements = chartFit.selectedMeasurements;
  } else if (nonEmptyTrimmed(values.selectedSize)) {
    fitPayload.selectedSize = values.selectedSize!.trim();
  }

  const yarnGaugeCanonical: Record<string, unknown> = {};
  if (hasBothGauge) {
    yarnGaugeCanonical.stitchGauge = gaugeStitchesPerInch;
    yarnGaugeCanonical.rowGauge = gaugeRowsPerInch;
    yarnGaugeCanonical.gaugeUnits = "per_inch";
    yarnGaugeCanonical.gaugeStitchRaw = gaugeStitchRaw;
    yarnGaugeCanonical.gaugeRowRaw = gaugeRowRaw;
    yarnGaugeCanonical.gaugeRawUnit = unit;
  } else if (gaugeStitchRaw || gaugeRowRaw) {
    yarnGaugeCanonical.gaugeStitchRaw = gaugeStitchRaw;
    yarnGaugeCanonical.gaugeRowRaw = gaugeRowRaw;
    yarnGaugeCanonical.gaugeRawUnit = unit;
  }

  const yarnMachinePayload: Record<string, unknown> = {
    yarnNotes: "",
    yarnWeight: "",
    availableNeedles: resolveExpressAvailableNeedles(prevMachine),
    gaugeStitchRaw,
    gaugeRowRaw,
    gaugeRawUnit: unit,
    gaugeStitchesPerInch,
    gaugeRowsPerInch,
  };

  const hasStyle = Object.keys(stylePayload).length > 0;
  const hasFit = Object.keys(fitPayload).length > 0;
  const hasYarn = Object.keys(yarnGaugeCanonical).length > 0;
  if (!hasStyle && !hasFit && !hasYarn) return;

  saveCurrentPattern({
    ...(hasStyle ? { style: stylePayload } : {}),
    ...(hasFit ? { fit: fitPayload } : {}),
    ...(hasYarn ? { yarnGauge: yarnGaugeCanonical } : {}),
    machine: {},
  });

  if (hasStyle) savePatternData("style", stylePayload);
  if (hasFit) savePatternData("fit", fitPayload);

  if (hasYarn || gaugeStitchRaw || gaugeRowRaw) {
    savePatternData("yarnGaugeMachine", { ...prevMachine, ...yarnMachinePayload });
  }
}

function persistExpressBuilderState(
  values: Record<string, string>,
  chartFit: { selectedSize: string; selectedMeasurements: Record<string, number> } | null,
) {
  const prevMachine =
    (getPatternData().yarnGaugeMachine as Record<string, unknown> | undefined) ?? {};
  const stitchEl = document.getElementById(GAUGE_STITCH_ID);
  const rowEl = document.getElementById(GAUGE_ROW_ID);
  if (!(stitchEl instanceof HTMLInputElement) || !(rowEl instanceof HTMLInputElement)) return;

  const unit = getExpressGaugeUnit();
  const gaugeStitchRaw = stitchEl.value.trim();
  const gaugeRowRaw = rowEl.value.trim();
  const { gaugeStitchesPerInch, gaugeRowsPerInch } = rawSwatchToPerInch(gaugeStitchRaw, gaugeRowRaw, unit);

  const aud = normalizeSleevelessAudience(values.who ?? "") || "misses";
  const sm = mapExpressStyle(values.style ?? "");
  const neck = mapExpressNeckline(values.neckline ?? "round");
  const fitEase = values.fit ?? "standard";

  const stylePayload: Record<string, string> = {
    recipientCategory: aud,
    bodyShape: sm.bodyShape,
    frontStyle: sm.frontStyle,
    neckline: neck,
    length: "top",
    armholeStyle: "standard",
    patternMode: "express",
  };

  const fitPayload: Record<string, unknown> = {
    sizingChart: aud,
    easeChoice: fitEase,
    fitChoice: fitEase,
  };
  if (chartFit) {
    fitPayload.selectedSize = chartFit.selectedSize;
    fitPayload.selectedMeasurements = chartFit.selectedMeasurements;
  }

  const yarnMachinePayload = {
    yarnNotes: "",
    yarnWeight: "",
    gaugeStitchesPerInch,
    gaugeRowsPerInch,
    gaugeStitchRaw,
    gaugeRowRaw,
    gaugeRawUnit: unit,
    availableNeedles: resolveExpressAvailableNeedles(prevMachine),
  };

  saveCurrentPattern({
    style: stylePayload as Record<string, unknown>,
    fit: fitPayload,
    yarnGauge: {
      stitchGauge: gaugeStitchesPerInch,
      rowGauge: gaugeRowsPerInch,
      gaugeUnits: "per_inch",
      gaugeStitchRaw,
      gaugeRowRaw,
      gaugeRawUnit: unit,
    },
    machine: {},
  });

  savePatternData("style", stylePayload);
  savePatternData("fit", fitPayload);
  savePatternData("yarnGaugeMachine", yarnMachinePayload);
}

function stepSection(step: number): HTMLElement | null {
  return document.querySelector(`[data-express-step="${step}"]`);
}

function gaugeOk(): boolean {
  const st = document.getElementById(GAUGE_STITCH_ID);
  const rw = document.getElementById(GAUGE_ROW_ID);
  if (!(st instanceof HTMLInputElement) || !(rw instanceof HTMLInputElement)) return false;
  return isValidPositiveNumber(st.value) && isValidPositiveNumber(rw.value);
}

function formatGaugeSummary(): string {
  const st = document.getElementById(GAUGE_STITCH_ID);
  const rw = document.getElementById(GAUGE_ROW_ID);
  if (!(st instanceof HTMLInputElement) || !(rw instanceof HTMLInputElement)) return "";
  if (!gaugeOk()) return "";
  const s = parseFloat(st.value.trim());
  const r = parseFloat(rw.value.trim());
  if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(r) || r <= 0) return "";
  const unit = getExpressGaugeUnit();
  const over = unit === "cm" ? "10 cm" : '4"';
  return `${Math.round(s)} sts × ${Math.round(r)} rows over ${over}`;
}

interface ExpressPersistedV1 {
  values?: Record<string, string>;
  openStep?: number;
  maxReachable?: number;
  gaugeStitchRaw?: string;
  gaugeRowRaw?: string;
}

function loadExpressPersisted(): ExpressPersistedV1 | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as ExpressPersistedV1;
  } catch {
    return null;
  }
}

/** Furthest step the user can open from accumulated Express choices (steps 1–5). Size lives inside step 1. */
function maxReachableFromChoices(v: Record<string, string>): number {
  let m = 1;
  if (v.who && nonEmptyTrimmed(v.selectedSize)) m = 2;
  if (v.who && nonEmptyTrimmed(v.selectedSize) && expressStyleStepComplete(v)) m = 3;
  if (v.who && nonEmptyTrimmed(v.selectedSize) && expressStyleStepComplete(v) && v.neckline) m = 4;
  if (v.who && nonEmptyTrimmed(v.selectedSize) && expressStyleStepComplete(v) && v.neckline && v.fit) m = 5;
  return m;
}

function initExpressPage() {
  const persisted = loadExpressPersisted();
  const values: Record<string, string> =
    persisted?.values && typeof persisted.values === "object" && !Array.isArray(persisted.values)
      ? { ...persisted.values }
      : {};
  migrateExpressStyleFields(values);
  if (!values.front) values.front = "closed";
  migrateExpressNecklineExpressFree(values);
  let maxReachable = maxReachableFromChoices(values);
  let openStep =
    typeof persisted?.openStep === "number" && Number.isFinite(persisted.openStep)
      ? Math.min(maxReachable, Math.max(0, Math.floor(persisted.openStep)))
      : 1;

  const sections = document.querySelectorAll("[data-express-step]");
  const pills = document.querySelectorAll("[data-pill-step]");

  function persistExpressSession(): void {
    if (typeof localStorage === "undefined") return;
    const stEl = document.getElementById(GAUGE_STITCH_ID);
    const rwEl = document.getElementById(GAUGE_ROW_ID);
    try {
      localStorage.setItem(
        SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
        JSON.stringify({
          values: { ...values },
          openStep,
          maxReachable,
          gaugeStitchRaw: stEl instanceof HTMLInputElement ? stEl.value : "",
          gaugeRowRaw: rwEl instanceof HTMLInputElement ? rwEl.value : "",
        }),
      );
    } catch {
      /* quota */
    }
  }

  if (persisted) {
    const stEl = document.getElementById(GAUGE_STITCH_ID);
    const rwEl = document.getElementById(GAUGE_ROW_ID);
    if (typeof persisted.gaugeStitchRaw === "string" && stEl instanceof HTMLInputElement) {
      stEl.value = persisted.gaugeStitchRaw;
    }
    if (typeof persisted.gaugeRowRaw === "string" && rwEl instanceof HTMLInputElement) {
      rwEl.value = persisted.gaugeRowRaw;
    }
  }

  function summaryText(field: string): string {
    if (field === "gauge") {
      const g = formatGaugeSummary();
      return g || "";
    }
    if (field === "who") {
      const whoKey = values.who;
      const whoLabel =
        whoKey && LABELS.who[whoKey] ? LABELS.who[whoKey] : whoKey ? String(whoKey) : "";
      if (!whoLabel) return "";
      if (!nonEmptyTrimmed(values.selectedSize)) return whoLabel;
      return `${whoLabel} • Size ${values.selectedSize!.trim()}`;
    }
    if (field === "style") {
      const sh = values.shape;
      const fr = values.front;
      if (!sh || !fr) return "";
      const a = EXPRESS_SUMMARY_SHAPE[sh];
      const b = EXPRESS_SUMMARY_FRONT[fr];
      if (!a || !b) return "";
      return `${a} • ${b}`;
    }
    const v = values[field];
    if (!v) return "";
    const map = LABELS[field];
    return map && map[v] ? map[v] : v;
  }

  function isStepComplete(step: number): boolean {
    if (step === 1) {
      return !!(values.who && nonEmptyTrimmed(values.selectedSize));
    }
    const sec = stepSection(step);
    const f = sec?.getAttribute("data-express-field");
    if (f === "gauge") return gaugeOk();
    if (f === "style") return expressStyleStepComplete(values);
    return !!(f && values[f]);
  }

  function clearAllLockedFeedback() {
    document.querySelectorAll("[data-express-locked-feedback]").forEach((el) => {
      el.setAttribute("hidden", "");
    });
  }

  function showLockedFeedback(sectionEl: HTMLElement | null) {
    clearAllLockedFeedback();
    const fb = sectionEl?.querySelector("[data-express-locked-feedback]");
    if (fb) fb.removeAttribute("hidden");
  }

  function updateSummaries() {
    document.querySelectorAll("[data-express-summary]").forEach((el) => {
      const key = el.getAttribute("data-express-summary");
      if (!key) return;
      el.textContent = summaryText(key);
    });
  }

  function isBuilderComplete(): boolean {
    return (
      !!values.who &&
      nonEmptyTrimmed(values.selectedSize) &&
      expressStyleStepComplete(values) &&
      !!values.neckline &&
      !!values.fit &&
      gaugeOk()
    );
  }

  function updateGenerateVisibility() {
    const wrap = document.getElementById("express-generate-wrap");
    if (!wrap) return;
    const complete = isBuilderComplete();
    if (complete) wrap.removeAttribute("hidden");
    else wrap.setAttribute("hidden", "");

    const btn = document.getElementById("express-generate");
    if (btn instanceof HTMLButtonElement) btn.disabled = !complete;
  }

  function updatePills() {
    pills.forEach((btn) => {
      const step = parseInt(btn.getAttribute("data-pill-step") ?? "0", 10);
      const label = btn.getAttribute("data-pill-label") || `Step ${step}`;
      const complete = isStepComplete(step);
      const isCurrent = step === openStep;
      const item = btn.closest(".sg-builder-nav__item");

      btn.classList.toggle("is-complete", complete);
      btn.classList.toggle("is-current", isCurrent);
      btn.classList.toggle("is-upcoming", step > maxReachable);

      if (step > maxReachable) {
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("title", LOCKED_STEP_NAV_TITLE);
      } else {
        btn.removeAttribute("aria-disabled");
        btn.removeAttribute("title");
      }

      if (item) item.classList.toggle("active", isCurrent);

      if (isCurrent) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");

      if (complete) btn.setAttribute("aria-label", `${label}, completed`);
      else if (isCurrent) btn.setAttribute("aria-label", `${label}, current`);
      else if (step > maxReachable) btn.setAttribute("aria-label", `${label}, locked`);
      else btn.setAttribute("aria-label", label);
    });
  }

  function setBodyHidden(sectionEl: HTMLElement, hide: boolean) {
    const body = sectionEl.querySelector(".express-acc__body");
    if (!body) return;
    if (hide) body.setAttribute("hidden", "");
    else body.removeAttribute("hidden");
  }

  function refreshBuilderState(persist = true): void {
    maxReachable = maxReachableFromChoices(values);
    if (openStep > maxReachable) openStep = maxReachable;
    if (openStep < 0) openStep = 0;
    updatePills();
    updateSections();
    if (persist) persistExpressSession();
  }

  function updateSections() {
    sections.forEach((el) => {
      const sectionEl = el as HTMLElement;
      const step = parseInt(sectionEl.getAttribute("data-express-step") ?? "0", 10);
      const open = step === openStep;
      const locked = step > maxReachable;
      const complete = isStepComplete(step);

      sectionEl.classList.toggle("express-acc--open", open);
      sectionEl.classList.toggle("express-acc--locked", locked);
      sectionEl.classList.toggle("express-acc--complete", complete);

      const header = sectionEl.querySelector("[data-express-header]");
      if (header) {
        header.setAttribute("aria-expanded", open ? "true" : "false");
        header.setAttribute("tabindex", "0");
      }

      const lockedFb = sectionEl.querySelector("[data-express-locked-feedback]");
      if (lockedFb && !locked) lockedFb.setAttribute("hidden", "");

      if (open) {
        setBodyHidden(sectionEl, false);
        sectionEl.removeAttribute("aria-hidden");
      } else {
        setBodyHidden(sectionEl, true);
      }

      if (step === STEPS) {
        const stIn = document.getElementById(GAUGE_STITCH_ID);
        const rwIn = document.getElementById(GAUGE_ROW_ID);
        [stIn, rwIn].forEach((inp) => {
          if (!(inp instanceof HTMLElement)) return;
          if (!open) inp.setAttribute("tabindex", "-1");
          else inp.removeAttribute("tabindex");
        });
      }
    });

    const genBtn = document.getElementById("express-generate");
    if (genBtn) {
      if (openStep === STEPS) genBtn.removeAttribute("tabindex");
      else genBtn.setAttribute("tabindex", "-1");
    }

    updateSummaries();
    updateGenerateVisibility();
    applySelectionUI();
  }

  function goToStep(step: number) {
    if (step < 1 || step > STEPS) return;
    if (step > maxReachable) return;
    clearAllLockedFeedback();
    openStep = step;
    refreshBuilderState();
  }

  function updateExpressShapePreviewImages(): void {
    const sec = stepSection(2);
    if (!sec) return;
    const fr = values.front === "open" ? "open" : "closed";
    const map = fr === "open" ? EXPRESS_SHAPE_PREVIEW_CARDIGAN : EXPRESS_SHAPE_PREVIEW_PULLOVER;
    sec.querySelectorAll("[data-express-shape-img]").forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      const key = img.getAttribute("data-express-shape-img");
      if (key && map[key]) img.src = map[key];
    });
  }

  function markChoiceSelected(sectionEl: HTMLElement, selectedEl: HTMLElement) {
    const scope =
      selectedEl.closest(".hat-length-picker__grid") ??
      selectedEl.closest(".express-options--who") ??
      selectedEl.closest(".express-options") ??
      sectionEl;
    scope.querySelectorAll(".express-option, .express-style-card, .hat-length-picker__option").forEach((el) => {
      el.classList.remove("express-option--selected", "express-style-card--selected", "is-selected");
      if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", "false");
    });
    scope.querySelectorAll(".express-option[data-choice]").forEach((el) => {
      el.setAttribute("aria-pressed", el === selectedEl ? "true" : "false");
    });
    if (selectedEl.classList.contains("express-style-card")) {
      selectedEl.classList.add("express-style-card--selected");
    } else if (selectedEl.classList.contains("hat-length-picker__option")) {
      selectedEl.classList.add("is-selected");
      selectedEl.setAttribute("aria-pressed", "true");
    } else {
      selectedEl.classList.add("express-option--selected");
    }
  }

  function refreshExpressWhoSizePanel(): void {
    const nested = document.querySelector("[data-express-nested-size]");
    if (!(nested instanceof HTMLElement)) return;

    if (!values.who) {
      nested.setAttribute("hidden", "");
      return;
    }
    nested.removeAttribute("hidden");

    const aud = normalizeSleevelessAudience(values.who) || "misses";
    const list = chartRowsByAudience[aud];
    const uiUnit = getExpressUiUnit();

    const sizeSet = chartSizeSets[aud];
    const hasLoadedSizes = sizeSet instanceof Set && sizeSet.size > 0;
    if (hasLoadedSizes && values.selectedSize && !sizeSet.has(String(values.selectedSize).trim())) {
      delete values.selectedSize;
    }

    const wrap = document.querySelector("[data-express-size-select-wrap]");
    const selectEl = document.querySelector("[data-express-size-select]");
    if (wrap instanceof HTMLElement && selectEl instanceof HTMLSelectElement) {
      if (Array.isArray(list) && list.length > 0) {
        wrap.removeAttribute("hidden");
        const placeholder = `<option value="">${escapeHtml("Choose a size…")}</option>`;
        const opts = list
          .map((row) => {
            const sz = normalizeChartRowSize(row);
            if (!sz) return "";
            const meas = formatBustChestDisplay(row, uiUnit);
            const label = `Size ${sz} — ${meas}`;
            return `<option value="${escapeAttr(sz)}">${escapeHtml(label)}</option>`;
          })
          .join("");
        selectEl.innerHTML = placeholder + opts;
        const chosen =
          values.selectedSize && isValidExpressSizeForAudience(aud, values.selectedSize)
            ? values.selectedSize.trim()
            : "";
        selectEl.value = chosen;
      } else {
        wrap.setAttribute("hidden", "");
        selectEl.innerHTML = `<option value="">${escapeHtml("Choose a size…")}</option>`;
      }
    }

  }

  /** Clears size only — uses same {@link maxReachableFromChoices} / accordion unlock rules as {@link selectExpressSize}. */
  function clearExpressSelectedSize(): void {
    if (!nonEmptyTrimmed(values.selectedSize)) return;
    delete values.selectedSize;
    clearAllLockedFeedback();
    refreshBuilderState();
  }

  function onExpressSizeSelectChange(ev: Event): void {
    const t = ev.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (!t.hasAttribute("data-express-size-select")) return;
    if (openStep !== 1) return;
    const v = t.value.trim();
    if (!v) {
      clearExpressSelectedSize();
      return;
    }
    selectExpressSize(v);
  }

  function applySelectionUI() {
    refreshExpressWhoSizePanel();
    const pairs: { step: number; field: keyof typeof LABELS; sel: string }[] = [
      { step: 1, field: "who", sel: ".express-options--who" },
      { step: 3, field: "neckline", sel: ".express-neck-cards" },
      { step: 4, field: "fit", sel: ".express-fit-cards" },
    ];
    pairs.forEach(({ step, field, sel }) => {
      const sec = stepSection(step);
      if (!sec || !values[field]) return;
      const c = sec.querySelector(sel);
      if (!c || !(c instanceof HTMLElement)) return;
      const hit = c.querySelector(`[data-choice][data-value="${values[field]}"]`);
      if (hit instanceof HTMLElement) markChoiceSelected(sec, hit);
    });
    const styleSec = stepSection(2);
    if (styleSec && values.shape) {
      const shapeGrid = styleSec.querySelector("[data-express-shape-grid]");
      const hit =
        shapeGrid?.querySelector(`[data-choice][data-field="shape"][data-value="${values.shape}"]`) ??
        null;
      if (hit instanceof HTMLElement) markChoiceSelected(styleSec, hit);
    }
    if (styleSec && values.front) {
      const frontToggle = styleSec.querySelector("[data-express-front-toggle]");
      const hit =
        frontToggle?.querySelector(`[data-field="front"][data-value="${values.front}"]`) ?? null;
      if (hit instanceof HTMLElement) markChoiceSelected(styleSec, hit);
    }
    updateExpressShapePreviewImages();
  }

    function onChoiceClick(ev: Event) {
      const target = ev.target;
      if (!(target instanceof Element)) return;
    const btn = target.closest("[data-choice]");
    if (!btn) return;
    const sec = btn.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    const stepNum = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (stepNum !== openStep) return;

    const field = btn.getAttribute("data-field");
    const value = btn.getAttribute("data-value");
    if (!field || value == null) return;

    if (field === "who") {
      const prevWho = values.who;
      if (prevWho !== undefined && prevWho !== value) {
        delete values.selectedSize;
      }
    }

    values[field] = value;
    if (field === "shape" || field === "front") {
      values.style = deriveExpressStyleKey(values.shape, values.front);
    }
    markChoiceSelected(sec, btn as HTMLElement);
    if (field === "front") {
      updateExpressShapePreviewImages();
    }

    if (field === "who") {
      refreshExpressWhoSizePanel();
    }

    clearAllLockedFeedback();
    refreshBuilderState();
  }

  /** Size dropdown — single source of truth: `values.selectedSize`. Unlocks the next step when valid. */
  function selectExpressSize(sizeValue: string): void {
    const trimmed = String(sizeValue).trim();
    if (!trimmed) return;
    if (openStep !== 1) return;
    const aud = normalizeSleevelessAudience(values.who) || "misses";
    if (!isValidExpressSizeForAudience(aud, trimmed)) return;

    values.selectedSize = trimmed;

    refreshExpressWhoSizePanel();
    clearAllLockedFeedback();
    refreshBuilderState();
  }

  function onHeaderActivate(ev: Event) {
    const h = ev.currentTarget;
    if (!(h instanceof HTMLElement)) return;
    const sec = h.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    const step = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (step > maxReachable) {
      showLockedFeedback(sec);
      return;
    }
    if (openStep === step) {
      clearAllLockedFeedback();
      openStep = 0;
      refreshBuilderState();
      return;
    }
    goToStep(step);
  }

    function onHeaderKey(ev: Event) {
      if (!(ev instanceof KeyboardEvent)) return;
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        onHeaderActivate(ev);
      }
    }

    function onChevronClick(ev: Event) {
      ev.stopPropagation();
    const btn = ev.currentTarget;
    if (!(btn instanceof Element)) return;
    const sec = btn.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    const step = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (step > maxReachable) return;
    const header = sec.querySelector("[data-express-header]");
    if (header instanceof HTMLElement) onHeaderActivate({ currentTarget: header } as unknown as Event);
  }

    function onPillClick(ev: Event) {
      const el = ev.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    if (el.getAttribute("aria-disabled") === "true") return;
    const step = parseInt(el.getAttribute("data-pill-step") ?? "0", 10);
    if (step >= 1 && step <= maxReachable) goToStep(step);
  }

  function onGaugeInput() {
    updateSummaries();
    updateGenerateVisibility();
    const secG = stepSection(STEPS);
    if (secG) secG.classList.toggle("express-acc--complete", gaugeOk());
    updatePills();
    persistExpressSession();
  }

  function resetExpressBuilder(): void {
    if (!confirm("Start over and clear your Express selections?")) return;
    try {
      localStorage.removeItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    for (const k of Object.keys(values)) {
      delete values[k];
    }
    values.front = "closed";
    openStep = 1;
    maxReachable = 1;

    const scope = document.querySelector("[data-express-builder]");
    if (scope) {
      scope.querySelectorAll("input, select, textarea").forEach((el) => {
        if (el instanceof HTMLInputElement) {
          if (el.type === "radio" || el.type === "checkbox") {
            el.checked = el.defaultChecked;
          } else {
            el.value = el.defaultValue ?? "";
          }
        } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
          el.value = el.defaultValue ?? "";
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });

      scope
        .querySelectorAll(
          ".express-option--selected, .express-style-card--selected, .is-selected, .selected",
        )
        .forEach((el) => {
          el.classList.remove(
            "express-option--selected",
            "express-style-card--selected",
            "is-selected",
            "selected",
          );
        });

      scope.querySelectorAll("[aria-pressed]").forEach((el) => {
        el.setAttribute("aria-pressed", "false");
      });
    }

    clearAllLockedFeedback();
    updatePills();
    updateSections();

    try {
      localStorage.removeItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    document.getElementById("express-pattern-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const root = document.getElementById("express-accordions");
  if (root) {
    root.addEventListener("click", onChoiceClick);
    root.addEventListener("change", onExpressSizeSelectChange);
  }

  document.querySelectorAll("[data-express-header]").forEach((h) => {
    h.addEventListener("click", onHeaderActivate);
    h.addEventListener("keydown", onHeaderKey);
  });

  document.querySelectorAll("[data-express-chevron]").forEach((c) => {
    c.addEventListener("click", onChevronClick);
  });

  pills.forEach((p) => p.addEventListener("click", onPillClick));

  document.getElementById("express-start-over-btn")?.addEventListener("click", resetExpressBuilder);

  document.getElementById("express-customize-pattern")?.addEventListener("click", () => {
    void (async () => {
      try {
        await loadExpressSweaterCharts();
      } catch {
        window.alert("Could not load size charts. Check your connection and try again.");
        return;
      }
      const aud = normalizeSleevelessAudience(values.who) || "misses";
      const chartFit = nonEmptyTrimmed(values.selectedSize)
        ? resolveExpressChartFit(aud, values.selectedSize!.trim(), values.fit || "standard")
        : null;
      syncExpressSelectionsToBuilderStorage(values, chartFit);
      window.location.assign("/patterns/sleeveless-custom");
    })();
  });

  const stitchesInput = document.getElementById(GAUGE_STITCH_ID);
  const rowsInput = document.getElementById(GAUGE_ROW_ID);
  const gaugeForm = document.getElementById("express-gauge-form");

  stitchesInput?.addEventListener("input", onGaugeInput);
  stitchesInput?.addEventListener("change", onGaugeInput);
  rowsInput?.addEventListener("input", onGaugeInput);
  rowsInput?.addEventListener("change", onGaugeInput);

  window.addEventListener("kbm:units-change", () => {
    onGaugeInput();
    refreshExpressWhoSizePanel();
    updateSummaries();
  });

  gaugeForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const stEl = document.getElementById(GAUGE_STITCH_ID);
    const rwEl = document.getElementById(GAUGE_ROW_ID);
    if (!(stEl instanceof HTMLInputElement) || !(rwEl instanceof HTMLInputElement)) return;
    if (!isValidPositiveNumber(stEl.value) || !isValidPositiveNumber(rwEl.value)) return;

    if (
      !values.who ||
      !nonEmptyTrimmed(values.selectedSize) ||
      !expressStyleStepComplete(values) ||
      !values.neckline ||
      !values.fit
    ) {
      window.alert("Please complete all Express steps before generating your pattern.");
      return;
    }

    const unit = getExpressGaugeUnit();
    const gaugeStitchRaw = stEl.value.trim();
    const gaugeRowRaw = rwEl.value.trim();
    const { gaugeStitchesPerInch, gaugeRowsPerInch } = rawSwatchToPerInch(gaugeStitchRaw, gaugeRowRaw, unit);

    const aud = normalizeSleevelessAudience(values.who) || "misses";
    const fitPref = values.fit;

    void (async () => {
      try {
        await loadExpressSweaterCharts();
      } catch {
        window.alert("Could not load size charts. Check your connection and try again.");
        return;
      }
      const chartFit = resolveExpressChartFit(aud, values.selectedSize!.trim(), fitPref);
      if (!chartFit) {
        window.alert("Please choose a valid size for this wearer.");
        return;
      }
      persistExpressBuilderState(values, chartFit);

      const q = new URLSearchParams();
      q.set("tab", "pattern");
      q.set("express", "1");
      if (values.who) q.set("who", values.who);
      if (values.style) q.set("style", values.style);
      if (values.neckline) q.set("neckline", values.neckline);
      if (values.fit) q.set("fit", values.fit);
      if (values.selectedSize) q.set("selectedSize", values.selectedSize);
      q.set("gaugeStitchRaw", gaugeStitchRaw);
      q.set("gaugeRowRaw", gaugeRowRaw);
      q.set("gaugeRawUnit", unit);
      q.set("stitches", gaugeStitchesPerInch);
      q.set("rows", gaugeRowsPerInch);

      window.location.href = `/patterns/sleeveless/pattern?${q.toString()}`;
    })();
  });

  void loadExpressSweaterCharts()
    .then(() => {
      const st = document.querySelector("[data-express-size-status]");
      if (st instanceof HTMLElement) st.setAttribute("hidden", "");
      refreshExpressWhoSizePanel();
      refreshBuilderState();
    })
    .catch(() => {
      const st = document.querySelector("[data-express-size-status]");
      if (st instanceof HTMLElement) {
        st.textContent = "Could not load size charts. Check your connection and refresh.";
        st.style.color = "#b91c1c";
        st.removeAttribute("hidden");
      }
    });

  refreshBuilderState();
}

function initExpressTopTabs(): void {
  const root = document.querySelector(".sleeveless-express-page .pattern-tabs");
  if (!root) return;
  initPatternTabs(root);

  try {
    const u = new URL(window.location.href);
    if (u.searchParams.get("tab") === "pattern") {
      u.searchParams.delete("tab");
      const qs = u.searchParams.toString();
      window.history.replaceState({}, "", `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`);
    }
  } catch {
    /* ignore */
  }
}

if (typeof document !== "undefined") {
  const boot = (): void => {
    initExpressPage();
    initExpressTopTabs();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
