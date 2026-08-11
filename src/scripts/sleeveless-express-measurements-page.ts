/**
 * Express Build — measurement confirmation (/patterns/sleeveless-express-measurements).
 * Summary from URL query, Express localStorage snapshot, and patternBuilderData (after Generate Pattern).
 */
import {
  loadExpressSweaterCharts,
  expressWhoToChartAudience,
  resolveExpressChartFit,
  findExpressChartRow,
  formatBustChestDisplay,
  getExpressUiUnit,
  nonEmptyTrimmed,
  SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import { formatSwatchCountForGaugeInput } from "../lib/patterns/gaugeDisplayFormat";
import { getDefaultHemLengthInches } from "../lib/patterns/hemDefaults";
import type { ChartRow } from "../lib/patterns/sleevelessExpressSizeChartTypes";
import { getPatternData, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "../lib/patterns/patternStorage";
import { syncSleevelessDesignBasicsToPatternStorage } from "../lib/patterns/syncSleevelessExpressDesignToStorage";
import {
  clearMeasureReviewSummaryLine,
  renderMeasureReviewSummaryLine,
  type MeasureReviewSummarySegment,
} from "../lib/patterns/sleevelessMeasureReviewSummaryUi";
import { SLEEVELESS_REVIEW_CONTEXT_READY_EVENT } from "../lib/patterns/sleevelessPatternProjectMeta";
import {
  applyMeasurementTargetToBox,
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS,
} from "../lib/patterns/patternSummaryMeasurementOverlay";
import { resolveMeasurementBlueprintSvgUrl } from "../lib/patterns/measurementBlueprintSvgUrl";

const LOG_PREFIX = "[express-measurements]";

function warn(msg: string, detail?: unknown): void {
  if (detail !== undefined) console.warn(`${LOG_PREFIX} ${msg}`, detail);
  else console.warn(`${LOG_PREFIX} ${msg}`);
}

function toFiniteNumber(v: unknown): number {
  if (v === undefined || v === null) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function formatLengthDisplay(inches: number, unit: "in" | "cm"): string {
  if (!Number.isFinite(inches)) return "—";
  if (unit === "cm") {
    const cm = inches * 2.54;
    const rounded = Math.round(cm * 10) / 10;
    return `${rounded} cm`;
  }
  return `${formatSwatchCountForGaugeInput(inches)}"`;
}

interface ExpressLsSnapshot {
  values: Record<string, string>;
  gaugeStitchRaw: string;
  gaugeRowRaw: string;
}

function readExpressBuilderLocalStorage(): ExpressLsSnapshot {
  if (typeof localStorage === "undefined") return { values: {}, gaugeStitchRaw: "", gaugeRowRaw: "" };
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return { values: {}, gaugeStitchRaw: "", gaugeRowRaw: "" };
    const p = JSON.parse(raw) as {
      values?: Record<string, string>;
      gaugeStitchRaw?: string;
      gaugeRowRaw?: string;
    };
    const values = p?.values && typeof p.values === "object" && !Array.isArray(p.values) ? { ...p.values } : {};
    return {
      values,
      gaugeStitchRaw: typeof p?.gaugeStitchRaw === "string" ? p.gaugeStitchRaw : "",
      gaugeRowRaw: typeof p?.gaugeRowRaw === "string" ? p.gaugeRowRaw : "",
    };
  } catch {
    return { values: {}, gaugeStitchRaw: "", gaugeRowRaw: "" };
  }
}

/** When URL omits `who`, infer Express "who" key from saved fit chart audience (Express stores misses/plus/men/…). */
function inferWhoFromFitAudience(sizingChart: unknown): string {
  const c = String(sizingChart ?? "").trim().toLowerCase();
  if (c === "misses" || c === "plus") return "women";
  if (c === "men") return "men";
  if (c === "kids") return "kids";
  if (c === "baby") return "baby";
  return "";
}

interface MergedMeasureContext {
  who: string;
  selectedSize: string;
  fit: string;
  neckline: string;
  style: string;
  /** Pullover vs cardigan from Express front style / stored pattern. */
  garmentStyle: "pullover" | "cardigan";
  gaugeStitchRaw: string;
  gaugeRowRaw: string;
  gaugeRawUnit: "in" | "cm";
  stitchesPerInch: string;
  rowsPerInch: string;
}

function expressStyleKeyIndicatesCardigan(styleKey: string): boolean {
  return String(styleKey ?? "")
    .toLowerCase()
    .includes("cardigan");
}

function mergeContextFromUrlStorageAndPattern(pageUrl: URL): MergedMeasureContext | null {
  const sp = pageUrl.searchParams;
  const ls = readExpressBuilderLocalStorage();
  const pb = getPatternData();
  const fit = pb.fit as Record<string, unknown> | undefined;
  const style = pb.style as Record<string, unknown> | undefined;
  const yarnG = pb.yarnGauge as Record<string, unknown> | undefined;
  const yarnM = pb.yarnGaugeMachine as Record<string, unknown> | undefined;

  let who = sp.get("who")?.trim() ?? ls.values.who?.trim() ?? "";
  if (!who) who = inferWhoFromFitAudience(fit?.sizingChart);
  if (!who) {
    warn("missing audience/who: not in URL, Express snapshot, or pattern fit.sizingChart");
  }

  let selectedSize =
    sp.get("selectedSize")?.trim() ?? ls.values.selectedSize?.trim() ?? String(fit?.selectedSize ?? "").trim();
  if (!selectedSize) {
    warn("missing size: not in URL, Express snapshot, or pattern fit.selectedSize");
  }

  const fitEase =
    sp.get("fit")?.trim() || ls.values.fit?.trim() || String(fit?.easeChoice ?? fit?.fitChoice ?? "standard").trim();

  let neckline = sp.get("neckline")?.trim() ?? ls.values.neckline?.trim() ?? "";
  if (!neckline) {
    const canonNeck = String(style?.neckline ?? "").trim().toLowerCase();
    if (canonNeck === "v") neckline = "v-neck";
    else if (canonNeck === "round") neckline = "round";
  }

  const styleKey = sp.get("style")?.trim() ?? ls.values.style?.trim() ?? "straight-pullover";
  const lsFront = String(ls.values.front ?? "").trim().toLowerCase();
  const urlGarmentParam = sp.get("garmentStyle")?.trim().toLowerCase() === "cardigan";
  const pbGarment = String(style?.garmentStyle ?? "").trim().toLowerCase() === "cardigan";
  const pbOpen = String(style?.frontStyle ?? "").trim().toLowerCase() === "open";

  let garmentStyle: "pullover" | "cardigan" = "pullover";
  if (
    urlGarmentParam ||
    pbGarment ||
    pbOpen ||
    lsFront === "open" ||
    expressStyleKeyIndicatesCardigan(styleKey)
  ) {
    garmentStyle = "cardigan";
  }

  let gaugeStitchRaw = sp.get("gaugeStitchRaw")?.trim() ?? ls.gaugeStitchRaw.trim();
  let gaugeRowRaw = sp.get("gaugeRowRaw")?.trim() ?? ls.gaugeRowRaw.trim();
  const gaugeRawUnitParam = sp.get("gaugeRawUnit")?.trim();
  const gaugeRawUnitStored = String(yarnM?.gaugeRawUnit ?? yarnG?.gaugeRawUnit ?? "").trim();
  const gaugeRawUnit: "in" | "cm" =
    gaugeRawUnitParam === "cm" || gaugeRawUnitStored === "cm" ? "cm" : "in";

  if (!gaugeStitchRaw) gaugeStitchRaw = String(yarnM?.gaugeStitchRaw ?? yarnG?.gaugeStitchRaw ?? "").trim();
  if (!gaugeRowRaw) gaugeRowRaw = String(yarnM?.gaugeRowRaw ?? yarnG?.gaugeRowRaw ?? "").trim();

  const stitchesPerInch =
    sp.get("stitches")?.trim() || String(yarnG?.stitchGauge ?? yarnM?.gaugeStitchesPerInch ?? "").trim();
  const rowsPerInch = sp.get("rows")?.trim() || String(yarnG?.rowGauge ?? yarnM?.gaugeRowsPerInch ?? "").trim();

  if (!nonEmptyTrimmed(who) || !nonEmptyTrimmed(selectedSize)) return null;

  return {
    who,
    selectedSize,
    fit: fitEase || "standard",
    neckline,
    style: styleKey,
    garmentStyle,
    gaugeStitchRaw,
    gaugeRowRaw,
    gaugeRawUnit,
    stitchesPerInch,
    rowsPerInch,
  };
}

const PATTERN_WORKSPACE_TAB_PATTERN_HREF = "/patterns/sleeveless/pattern/?tab=pattern";

/** Inline SVG is required to toggle measurement-line groups by id (external raster/img cannot be styled). */
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
  const svgUrl = resolveMeasurementBlueprintSvgUrl();
  try {
    const res = await fetch(svgUrl);
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
    svg.setAttribute("aria-label", "Measurement diagram for sleeveless garment");
    svg.setAttribute("focusable", "false");
    return svg;
  } catch (err) {
    warn("could not load inline measurement blueprint SVG; using img fallback", err);
    const img = document.createElement("img");
    img.className = "express-mbp-art";
    img.src = svgUrl;
    img.width = 142;
    img.height = 195;
    img.alt = "Measurement diagram for sleeveless garment";
    img.decoding = "async";
    return img;
  }
}

function showSummaryError(diagramEl: HTMLElement, title: string, body: string): void {
  const wrap = document.createElement("div");
  wrap.className = "express-measurements-summary-error";
  const h = document.createElement("p");
  h.className = "pattern-subtext express-measurements-summary-error__title";
  h.style.fontWeight = "600";
  h.style.color = "#b91c1c";
  h.textContent = title;
  const p = document.createElement("p");
  p.className = "pattern-subtext";
  p.textContent = body;
  wrap.appendChild(h);
  wrap.appendChild(p);
  diagramEl.replaceChildren(wrap);
}

const INCH_TO_CM = 2.54;

function dispatchExpressYarnDimensions(
  finishedBustInches: number,
  garmentLengthInches: number,
  uiUnit: "in" | "cm",
): void {
  const lengthUnit = uiUnit === "cm" ? "cm" : "in";
  const emptyDetail = { projectWidth: 0, projectLength: 0, lengthUnit, source: "custom" as const };
  if (!Number.isFinite(finishedBustInches) || !Number.isFinite(garmentLengthInches)) {
    window.dispatchEvent(new CustomEvent("kbm:yarnDimensions", { detail: emptyDetail }));
    return;
  }
  if (finishedBustInches <= 0 || garmentLengthInches <= 0) {
    window.dispatchEvent(new CustomEvent("kbm:yarnDimensions", { detail: emptyDetail }));
    return;
  }
  let projectWidth: number;
  let projectLength: number;
  if (lengthUnit === "in") {
    projectWidth = finishedBustInches;
    projectLength = garmentLengthInches;
  } else {
    projectWidth = Math.round(finishedBustInches * INCH_TO_CM * 10) / 10;
    projectLength = Math.round(garmentLengthInches * INCH_TO_CM * 10) / 10;
  }
  window.dispatchEvent(
    new CustomEvent("kbm:yarnDimensions", {
      detail: { projectWidth, projectLength, lengthUnit, source: "custom" },
    }),
  );
}

export function initExpressYarnDrawer(): void {
  const drawerRoot = document.getElementById("express-yarn-drawer");
  const openBtn = document.getElementById("express-yarn-drawer-open");
  const closeBtn = document.getElementById("express-yarn-drawer-close");
  const backdrop = document.getElementById("express-yarn-drawer-backdrop");
  let lastFocus: HTMLElement | null = null;

  function openDrawer(): void {
    if (!drawerRoot) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRoot.classList.add("is-open");
    drawerRoot.setAttribute("aria-hidden", "false");
    document.body.classList.add("hat-yarn-drawer-open");
    // Do not focus the close button on open — it can steal the first click and, combined
    // with swatch blur validation, block editing earlier fields while later ones are empty.
  }

  function closeDrawer(): void {
    if (!drawerRoot?.classList.contains("is-open")) return;
    drawerRoot.classList.remove("is-open");
    drawerRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hat-yarn-drawer-open");
    const restore = lastFocus;
    if (restore instanceof HTMLElement) {
      restore.focus();
    } else if (openBtn instanceof HTMLElement) {
      openBtn.focus();
    }
    lastFocus = null;
  }

  openBtn?.addEventListener("click", () => openDrawer());
  closeBtn?.addEventListener("click", () => closeDrawer());
  backdrop?.addEventListener("click", () => closeDrawer());

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (drawerRoot?.classList.contains("is-open")) {
      closeDrawer();
      e.preventDefault();
    }
  });
}

export type ExpressMeasurementsInitOptions = {
  /** Back link for error copy (unified builder review). */
  builderHref?: string;
  /** When true, caller already initialized the yarn drawer (unified review). */
  skipYarnDrawer?: boolean;
};

export function initExpressMeasurementsConfirmPage(options?: ExpressMeasurementsInitOptions): void {
  const builderHref = options?.builderHref?.trim() || "/patterns/sleeveless-express/";
  if (!options?.skipYarnDrawer) initExpressYarnDrawer();

  const rootMaybe = document.querySelector("[data-express-measurements-root]");
  if (!(rootMaybe instanceof HTMLElement)) {
    warn("script did not find target DOM node: [data-express-measurements-root]");
    return;
  }

  const root = rootMaybe;
  root.setAttribute("data-express-href", builderHref);

  const statusEl = root.querySelector("[data-express-measurements-status]");
  const summaryEl = root.querySelector("[data-express-measurements-summary]");
  const projectSummaryMaybe = root.querySelector("[data-express-measurements-project-summary]");

  if (!(summaryEl instanceof HTMLElement)) {
    warn("script did not find target DOM node: [data-express-measurements-summary]");
    return;
  }

  if (!(projectSummaryMaybe instanceof HTMLElement)) {
    warn("script did not find target DOM node: [data-express-measurements-project-summary]");
    return;
  }

  const projectSummaryHost: HTMLElement = projectSummaryMaybe;

  function setStatus(msg: string, isError: boolean): void {
    if (!(statusEl instanceof HTMLElement)) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle("express-measurements-status--error", isError);
    statusEl.removeAttribute("hidden");
  }

  function clearStatus(): void {
    if (!(statusEl instanceof HTMLElement)) return;
    statusEl.textContent = "";
    statusEl.setAttribute("hidden", "");
    statusEl.classList.remove("express-measurements-status--error");
  }

  function renderProjectSummary(segments: MeasureReviewSummarySegment[]): void {
    renderMeasureReviewSummaryLine(projectSummaryHost, segments);
  }

  function clearProjectSummary(): void {
    clearMeasureReviewSummaryLine(projectSummaryHost);
  }

  type BlueprintReadonlyBoxOpts = {
    /** Unicode arrow beside label (↕ vertical / ↔ horizontal) */
    axis?: "vertical" | "horizontal";
    /** Multi-line label; when set, overrides single-line `fieldLabel` display. */
    labelLines?: string[];
    targetId: string;
    anchorTransform?: string;
  };

  let blueprintOverlayPositionCleanup: (() => void) | null = null;

  function blueprintReadonlyBox(
    positionMod: string,
    fieldLabel: string,
    value: string,
    opts: BlueprintReadonlyBoxOpts,
  ): HTMLElement {
    const box = document.createElement("div");
    box.className = `express-mbp-box express-mbp-box--${positionMod}`;
    const lab = document.createElement("span");
    lab.className = "express-mbp-box__lab";
    const lines = opts?.labelLines?.filter((s) => nonEmptyTrimmed(s));
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
        text.textContent = fieldLabel;
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
      lab.textContent = fieldLabel;
    }
    const valEl = document.createElement("span");
    valEl.className = "express-mbp-box__value";
    valEl.textContent = value;
    box.append(lab, valEl);
    applyMeasurementTargetToBox(box, opts.targetId, {
      transform: opts.anchorTransform,
    });
    return box;
  }

  /** Primary garment length only — compact diagram chip (chart row field). */
  function formatGarmentLengthDiagramChip(row: ChartRow, unit: "in" | "cm"): string {
    const gl = toFiniteNumber(row.garment_back_length);
    return Number.isFinite(gl) ? formatLengthDisplay(gl, unit) : "—";
  }

  /** Front neck depth from computed chart measurements, then raw chart row (inches). */
  function formatNecklineDepthDisplay(m: Record<string, number>, row: ChartRow, unit: "in" | "cm"): string {
    const fromM = toFiniteNumber(m.front_neck_depth);
    if (Number.isFinite(fromM)) return formatLengthDisplay(fromM, unit);
    const fromRow = toFiniteNumber(row.front_neck_depth);
    return Number.isFinite(fromRow) ? formatLengthDisplay(fromRow, unit) : "—";
  }

  function hideContinue(): void {
    const el = root.querySelector("[data-express-measurements-continue]");
    if (el instanceof HTMLElement) el.setAttribute("hidden", "");
  }

  function wireContinueToPattern(
    merged: MergedMeasureContext,
    chartFit: { selectedSize: string; selectedMeasurements: Record<string, number> },
  ): void {
    const existing = root.querySelector("[data-express-measurements-continue]");
    if (!(existing instanceof HTMLAnchorElement)) return;
    const anchor = existing.cloneNode(true) as HTMLAnchorElement;
    existing.replaceWith(anchor);
    anchor.href = PATTERN_WORKSPACE_TAB_PATTERN_HREF;
    anchor.removeAttribute("hidden");
    anchor.addEventListener("click", (ev: MouseEvent) => {
      ev.preventDefault();
      const necklineForSync = merged.neckline === "v-neck" ? "v-neck" : "round";
      syncSleevelessDesignBasicsToPatternStorage({
        who: merged.who,
        neckline: necklineForSync,
        fit: merged.fit,
        selectedSize: chartFit.selectedSize,
        selectedMeasurements: chartFit.selectedMeasurements,
        frontStyle: merged.garmentStyle === "cardigan" ? "open" : "closed",
        garmentStyle: merged.garmentStyle,
        patternMode: "express",
      });
      window.location.assign(PATTERN_WORKSPACE_TAB_PATTERN_HREF);
    });
  }

  function renderFromUrl(): void {
    hideContinue();
    blueprintOverlayPositionCleanup?.();
    blueprintOverlayPositionCleanup = null;
    dispatchExpressYarnDimensions(NaN, NaN, getExpressUiUnit());
    clearProjectSummary();
    summaryEl.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "pattern-subtext";
    loading.textContent = "Loading measurements…";
    summaryEl.appendChild(loading);

    let pageUrl: URL;
    try {
      pageUrl = new URL(window.location.href);
    } catch {
      warn("invalid page URL");
      clearStatus();
      clearProjectSummary();
      showSummaryError(
        summaryEl,
        "Something went wrong",
        "This page URL could not be read. Use Express Build → Generate Pattern again.",
      );
      return;
    }

    void loadExpressSweaterCharts()
      .then(async () => {
        clearStatus();
        const merged = mergeContextFromUrlStorageAndPattern(pageUrl);
        if (!merged) {
          warn("merge failed: missing audience/who and/or size after URL + localStorage + pattern fallbacks");
          setStatus("Missing who or size. Return to Express Build and use Generate Pattern again.", true);
          clearProjectSummary();
          showSummaryError(
            summaryEl,
            "Could not load measurements",
            `We need your wearer (who) and pattern size. They were not in the link and not found in saved builder or pattern data. Go back to the builder, complete the steps, and tap Generate Pattern.`,
          );
          return;
        }

        const aud = expressWhoToChartAudience(merged.who);
        const chartFit = resolveExpressChartFit(aud, merged.selectedSize, merged.fit);
        if (!chartFit) {
          warn("selectedMeasurements / chart resolve failed: resolveExpressChartFit returned null", {
            audience: aud,
            size: merged.selectedSize,
            fit: merged.fit,
          });
          setStatus("That size is not on the chart for this wearer.", true);
          clearProjectSummary();
          showSummaryError(
            summaryEl,
            "Chart row not found",
            "We could not match your size on the sizing chart. Return to Express Build and pick a valid size.",
          );
          return;
        }

        const row = findExpressChartRow(aud, merged.selectedSize);
        if (!row) {
          warn("chart row not found after resolveExpressChartFit succeeded (unexpected)", {
            audience: aud,
            size: merged.selectedSize,
          });
          setStatus("Chart data is incomplete. Try refreshing the page.", true);
          clearProjectSummary();
          showSummaryError(
            summaryEl,
            "Chart row missing",
            "The sizing chart did not return a row for your selection. Refresh the page or return to Express Build.",
          );
          return;
        }

        try {
          const unit = getExpressUiUnit();
          const m = chartFit.selectedMeasurements;
          if (!m || typeof m !== "object") {
            warn("selectedMeasurements missing or invalid on chartFit", chartFit);
            setStatus("Measurement defaults are missing from the chart row.", true);
            clearProjectSummary();
            showSummaryError(
              summaryEl,
              "Measurements unavailable",
              "The chart row did not include computed measurements. Try again from Express Build.",
            );
            return;
          }

          const whoLabel =
            merged.who === "women"
              ? "Women"
              : merged.who === "men"
                ? "Men"
                : merged.who === "kids"
                  ? "Kids"
                  : merged.who === "baby"
                    ? "Baby"
                    : merged.who;
          const necklineLabel =
            merged.neckline === "v-neck" ? "V-neck" : merged.neckline ? "Round" : "—";
          const fitLabel = merged.fit ? merged.fit.charAt(0).toUpperCase() + merged.fit.slice(1) : "—";
          const garmentLabel = merged.garmentStyle === "cardigan" ? "Cardigan" : "Pullover";

          const neck = toFiniteNumber(row.neck_opening);
          const neckVal = Number.isFinite(neck) ? formatLengthDisplay(neck, unit) : "—";

          const chartBustChestDisplay = formatBustChestDisplay(row, unit);

          const finishedBustVal = Number.isFinite(m.finished_bust_chest)
            ? formatLengthDisplay(m.finished_bust_chest, unit)
            : "—";

          const backLenVal = formatGarmentLengthDiagramChip(row, unit);

          const necklineDepthVal = formatNecklineDepthDisplay(m, row, unit);

          const arm = toFiniteNumber(row.armhole_depth);
          const armVal = Number.isFinite(arm) ? formatLengthDisplay(arm, unit) : "—";

          const shoulder = toFiniteNumber(row.shoulder_width);
          const shoulderVal = Number.isFinite(shoulder) ? formatLengthDisplay(shoulder, unit) : "—";

          const ribbedHemDepthIn = getDefaultHemLengthInches(aud);
          const ribbedHemDepthVal = formatLengthDisplay(ribbedHemDepthIn, unit);

          const over = merged.gaugeRawUnit === "cm" ? "10 cm" : '4"';
          const gaugeVal =
            merged.gaugeStitchRaw && merged.gaugeRowRaw
              ? `${merged.gaugeStitchRaw} sts × ${merged.gaugeRowRaw} rows / ${over}`
              : "—";

          const sizeValue = chartBustChestDisplay
            ? `${chartFit.selectedSize} (${chartBustChestDisplay} bust/chest)`
            : chartFit.selectedSize;

          renderProjectSummary([
            { label: "Recipient", value: whoLabel },
            { label: "Size", value: sizeValue },
            { label: "Garment", value: garmentLabel },
            { label: "Neckline", value: necklineLabel },
            { label: "Fit", value: fitLabel },
            { label: "Gauge", value: gaugeVal },
          ]);

          document.dispatchEvent(
            new CustomEvent(SLEEVELESS_REVIEW_CONTEXT_READY_EVENT, {
              detail: {
                who: merged.who,
                neckline: merged.neckline === "v-neck" ? "v-neck" : "round",
                garmentStyle: merged.garmentStyle,
                chartAudience: aud,
              },
            }),
          );

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
          inner.dataset.measurementOverlayMode = "mobile";
          overlay.dataset.measurementOverlayMode = "mobile";
          stage.dataset.measurementOverlayMode = "mobile";
          scroll.dataset.measurementOverlayMode = "mobile";
          overlay.append(
            blueprintReadonlyBox("neck-opening", "Neck opening", neckVal, {
              axis: "horizontal",
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
            }),
            blueprintReadonlyBox("neckline-depth", "Neck depth", necklineDepthVal, {
              axis: "vertical",
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
            }),
            blueprintReadonlyBox("shoulder", "Shoulder width", shoulderVal, {
              axis: "horizontal",
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.chest,
            }),
            blueprintReadonlyBox("finished-bust", "", finishedBustVal, {
              axis: "horizontal",
              labelLines: ["FINISHED", "BUST CIRC"],
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.bust,
            }),
            blueprintReadonlyBox("armhole", "Armhole depth", armVal, {
              axis: "vertical",
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
            }),
            blueprintReadonlyBox("back-length", "Garment length", backLenVal, {
              axis: "vertical",
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.garmentLength,
            }),
            blueprintReadonlyBox("ribbed-hem-depth", "Hem depth", ribbedHemDepthVal, {
              axis: "vertical",
              targetId: PATTERN_SUMMARY_MEASUREMENT_TARGETS.hem,
              anchorTransform: "translate(-50%, -100%)",
            }),
          );

          inner.append(art, overlay);

          if (art instanceof SVGSVGElement) {
            blueprintOverlayPositionCleanup = bindPatternSummaryOverlayPositioning(
              inner,
              art,
              overlay,
              collectOverlayAnchors(overlay),
            );
          }
          stage.appendChild(inner);
          scroll.appendChild(stage);
          rootMbp.appendChild(scroll);

          summaryEl.replaceChildren(rootMbp);

          const finishedBustIn = toFiniteNumber(m.finished_bust_chest);
          const garmentLengthIn =
            toFiniteNumber(m.back_neck_to_hem) || toFiniteNumber(row.garment_back_length);
          dispatchExpressYarnDimensions(finishedBustIn, garmentLengthIn, unit);

          wireContinueToPattern(merged, chartFit);
        } catch (err) {
          console.error(`${LOG_PREFIX} render error`, err);
          setStatus("Could not render the measurement summary.", true);
          clearProjectSummary();
          showSummaryError(
            summaryEl,
            "Unexpected error",
            "Something went wrong while building the layout. Check the browser console for details.",
          );
        }
      })
      .catch((err) => {
        console.error(`${LOG_PREFIX} chart load failed`, err);
        setStatus("Could not load size charts. Check your connection and refresh.", true);
        clearProjectSummary();
        showSummaryError(
          summaryEl,
          "Charts unavailable",
          "We could not load sizing chart JSON. Check your connection and refresh this page.",
        );
      });
  }

  renderFromUrl();

  window.addEventListener("kbm:units-change", (ev: Event) => {
    const tid = (ev as CustomEvent<{ toggleId?: string }>).detail?.toggleId;
    if (tid != null && tid !== SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID) return;
    renderFromUrl();
  });
}

function shouldAutoInitExpressMeasurementsPage(): boolean {
  const root = document.querySelector("[data-express-measurements-root]");
  if (!(root instanceof HTMLElement)) return false;
  return !root.hasAttribute("data-sleeveless-review-managed");
}

if (typeof document !== "undefined") {
  const run = (): void => {
    if (!shouldAutoInitExpressMeasurementsPage()) return;
    initExpressMeasurementsConfirmPage();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
}
