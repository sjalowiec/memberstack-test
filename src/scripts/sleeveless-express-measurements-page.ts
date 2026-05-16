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

const CUSTOM_BUILD_HREF = "/patterns/sleeveless/custom-build/";

/** Same assets as `PatternTabs.astro` workspace Express / Custom tab icons */
const WORKSPACE_EXPRESS_TAB_ICON_SRC = "/images/quick-icon.svg";
const WORKSPACE_CUSTOM_TAB_ICON_SRC = "/images/KINlogo.svg";

const MEASUREMENT_BLUEPRINT_SVG_URL = "/images/patterns/pattern_summary.svg";

function workspaceTabIconImg(src: string): HTMLImageElement {
  const img = document.createElement("img");
  img.className = "express-mbp-edit-build-choices__workspace-icon";
  img.src = src;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.width = 18;
  img.height = 18;
  img.decoding = "async";
  return img;
}

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
    svg.setAttribute("aria-label", "Measurement diagram for sleeveless garment");
    svg.setAttribute("focusable", "false");
    return svg;
  } catch (err) {
    warn("could not load inline measurement blueprint SVG; using img fallback", err);
    const img = document.createElement("img");
    img.className = "express-mbp-art";
    img.src = MEASUREMENT_BLUEPRINT_SVG_URL;
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

function initExpressMeasurementsConfirmPage(): void {
  const rootMaybe = document.querySelector("[data-express-measurements-root]");
  if (!(rootMaybe instanceof HTMLElement)) {
    warn("script did not find target DOM node: [data-express-measurements-root]");
    return;
  }

  const root = rootMaybe;
  const expressHref =
    root.dataset.expressHref?.trim() || "/patterns/sleeveless-express/";

  const statusEl = root.querySelector("[data-express-measurements-status]");
  const summaryEl = root.querySelector("[data-express-measurements-summary]");
  const railFillMaybe = root.querySelector("[data-express-measurements-rail-fill]");

  if (!(summaryEl instanceof HTMLElement)) {
    warn("script did not find target DOM node: [data-express-measurements-summary]");
    return;
  }

  if (!(railFillMaybe instanceof HTMLElement)) {
    warn("script did not find target DOM node: [data-express-measurements-rail-fill]");
    return;
  }

  const railHost: HTMLElement = railFillMaybe;

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

  function metaChip(keyLabel: string, value: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "express-mbp-meta__item";
    const k = document.createElement("span");
    k.className = "express-mbp-meta__k";
    k.textContent = keyLabel;
    const v = document.createElement("span");
    v.className = "express-mbp-meta__v";
    v.textContent = value;
    el.append(k, v);
    return el;
  }

  /** Size name plus chart body bust/chest (not finished/ease measurement). */
  function metaChipSize(sizeLabel: string, chartBustChestDisplay: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "express-mbp-meta__item express-mbp-meta__item--size";
    const k = document.createElement("span");
    k.className = "express-mbp-meta__k";
    k.textContent = "Size";
    const v = document.createElement("span");
    v.className = "express-mbp-meta__v";
    v.textContent = sizeLabel;
    const sub = document.createElement("span");
    sub.className = "express-mbp-meta__sub";
    sub.textContent = `${chartBustChestDisplay} bust/chest`;
    el.append(k, v, sub);
    return el;
  }

  function gaugeSummaryCard(gaugeDisplay: string): HTMLElement {
    const card = document.createElement("div");
    card.className = "express-mbp-gauge-card";
    const title = document.createElement("h2");
    title.className = "express-mbp-gauge-card__title";
    title.textContent = "GAUGE (FROM YOUR SWATCH)";
    const value = document.createElement("p");
    value.className = "express-mbp-gauge-card__value";
    value.textContent = gaugeDisplay;
    card.append(title, value);
    return card;
  }

  type BlueprintReadonlyBoxOpts = {
    /** Unicode arrow beside label (↕ vertical / ↔ horizontal) */
    axis?: "vertical" | "horizontal";
    /** Multi-line label; when set, overrides single-line `fieldLabel` display. */
    labelLines?: string[];
  };

  function blueprintReadonlyBox(
    positionMod: string,
    fieldLabel: string,
    value: string,
    opts?: BlueprintReadonlyBoxOpts,
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
    const unitsHostEl =
      railHost.querySelector<HTMLElement>("[data-express-measurements-units-host]") ??
      document.querySelector<HTMLElement>("[data-express-measurements-units-host]");
    unitsHostEl?.remove();

    const parkUnitsHostInRail = (): void => {
      if (unitsHostEl && !unitsHostEl.isConnected) railHost.appendChild(unitsHostEl);
    };

    railHost.replaceChildren();
    summaryEl.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "pattern-subtext";
    loading.textContent = "Loading measurements…";
    summaryEl.appendChild(loading);
    parkUnitsHostInRail();

    let pageUrl: URL;
    try {
      pageUrl = new URL(window.location.href);
    } catch {
      warn("invalid page URL");
      clearStatus();
      railHost.replaceChildren();
      parkUnitsHostInRail();
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
          railHost.replaceChildren();
          parkUnitsHostInRail();
          showSummaryError(
            summaryEl,
            "Could not load measurements",
            "We need your wearer (who) and pattern size. They were not in the link and not found in saved Express Build or pattern data. Go back to Express Build, complete the steps, and tap Generate Pattern.",
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
          railHost.replaceChildren();
          parkUnitsHostInRail();
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
          railHost.replaceChildren();
          parkUnitsHostInRail();
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
            railHost.replaceChildren();
            parkUnitsHostInRail();
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

          const meta = document.createElement("div");
          meta.className = "express-mbp-meta";
          const editWrap = document.createElement("p");
          editWrap.className = "express-mbp-edit-build-choices";
          const editLead = document.createElement("strong");
          editLead.className = "express-mbp-edit-build-choices__lead";
          editLead.textContent = "Need different measurements?";
          editWrap.appendChild(editLead);
          const expressLine = document.createElement("p");
          expressLine.className = "express-mbp-edit-build-choices-line pattern-subtext";
          expressLine.append(
            workspaceTabIconImg(WORKSPACE_EXPRESS_TAB_ICON_SRC),
            document.createTextNode("Express Build gets you knitting quickly"),
          );
          const customLine = document.createElement("p");
          customLine.className = "express-mbp-edit-build-choices-line pattern-subtext";
          const customBuildLink = document.createElement("a");
          customBuildLink.href = CUSTOM_BUILD_HREF;
          customBuildLink.className = "express-custom-build-callout__link";
          customBuildLink.textContent = "Custom Build";
          customLine.append(
            workspaceTabIconImg(WORKSPACE_CUSTOM_TAB_ICON_SRC),
            customBuildLink,
            document.createTextNode(" allows for more styling options and detailed fit"),
          );
          const metaGrid = document.createElement("div");
          metaGrid.className = "express-mbp-meta__grid";
          const metaChips: HTMLElement[] = [
            metaChip("Who", whoLabel),
            metaChipSize(chartFit.selectedSize, chartBustChestDisplay),
          ];
          metaChips.push(metaChip("Garment", garmentLabel));
          metaChips.push(metaChip("Neckline", necklineLabel), metaChip("Fit ease", fitLabel));
          metaGrid.append(...metaChips);
          meta.append(editWrap, expressLine, customLine);
          if (unitsHostEl) meta.appendChild(unitsHostEl);
          meta.appendChild(metaGrid);

          const reassurance = document.createElement("div");
          reassurance.className = "express-mbp-rail-reassurance pattern-subtext";
          reassurance.setAttribute("role", "note");
          const reassuranceTitle = document.createElement("p");
          reassuranceTitle.className = "express-mbp-rail-reassurance__lead";
          const goBackLink = document.createElement("a");
          goBackLink.href = expressHref;
          goBackLink.className = "express-custom-build-callout__link";
          goBackLink.textContent = "go back";
          reassuranceTitle.append(
            document.createTextNode("You can still "),
            goBackLink,
            document.createTextNode(" and change:"),
          );
          const reassuranceList = document.createElement("ul");
          reassuranceList.className = "express-mbp-rail-reassurance__list";
          for (const item of ["size", "neckline", "fit ease", "gauge"]) {
            const li = document.createElement("li");
            li.textContent = item;
            reassuranceList.appendChild(li);
          }
          reassurance.append(reassuranceTitle, reassuranceList);

          railHost.replaceChildren(meta, gaugeSummaryCard(gaugeVal), reassurance);

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
          overlay.append(
            blueprintReadonlyBox("neck-opening", "Neck opening", neckVal, { axis: "horizontal" }),
            blueprintReadonlyBox("neckline-depth", "Neck depth", necklineDepthVal, { axis: "vertical" }),
            blueprintReadonlyBox("shoulder", "Shoulder width", shoulderVal, { axis: "horizontal" }),
            blueprintReadonlyBox("finished-bust", "", finishedBustVal, {
              axis: "horizontal",
              labelLines: ["FINISHED", "BUST (EASE)"],
            }),
            blueprintReadonlyBox("armhole", "Armhole depth", armVal, { axis: "vertical" }),
            blueprintReadonlyBox("back-length", "Garment length", backLenVal, { axis: "vertical" }),
            blueprintReadonlyBox("ribbed-hem-depth", "Ribbed hem depth", ribbedHemDepthVal, {
              axis: "vertical",
            }),
          );

          inner.append(art, overlay);
          stage.appendChild(inner);
          scroll.appendChild(stage);
          rootMbp.appendChild(scroll);

          summaryEl.replaceChildren(rootMbp);

          wireContinueToPattern(merged, chartFit);
        } catch (err) {
          console.error(`${LOG_PREFIX} render error`, err);
          setStatus("Could not render the measurement summary.", true);
          railHost.replaceChildren();
          parkUnitsHostInRail();
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
        railHost.replaceChildren();
        parkUnitsHostInRail();
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

if (typeof document !== "undefined") {
  const run = (): void => initExpressMeasurementsConfirmPage();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
}
