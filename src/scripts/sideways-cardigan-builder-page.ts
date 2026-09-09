/**
 * Sideways Cardigan builder — Express-style steps without importing the
 * Drop Shoulder / Sleeveless wizard client (those builders stay unchanged).
 */
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { readHydratedConstructionBaseline } from "../lib/patterns/customPatternProjectConstructionBaseline";
import {
  applySleevelessExpressNewSessionFromUrl,
  startFreshSleevelessExpressPattern,
} from "../lib/patterns/sleevelessExpressFreshStart";
import {
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
} from "../lib/patterns/sleevelessExpressAvailableNeedles";
import {
  EXPRESS_GAUGE_ROW_INPUT_ID,
  EXPRESS_GAUGE_STITCH_INPUT_ID,
  syncExpressNeedleBlockVisibility,
  wireExpressBuilderReviewSubmit,
} from "../lib/patterns/expressBuilderReviewSubmit";
import {
  buildExpressStandardBodyMeasurementsSummaryFromRow,
  formatBustChestDisplay,
  getExpressUiUnit,
  loadExpressSweaterCharts,
  normalizeChartRowSize,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import { formatFitEaseApproxLabel } from "../lib/patterns/fitEaseInches";
import { rawSwatchToPerInch } from "../lib/patterns/syncExpressWizardToPatternStorage";
import {
  findSidewaysCardiganWomenChartRow,
  getSidewaysCardiganChartRowsForAudience,
  sidewaysCardiganChartAudienceDisplayLabel,
  type SidewaysCardiganWomenChartAudience,
  type SidewaysCardiganWomenChartRow,
} from "../lib/patterns/sidewaysCardiganSizeCharts";
import {
  parseSidewaysCardiganGarmentStyle,
  parseSidewaysCardiganSleeveDirection,
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import { syncSidewaysCardiganBuilderToPatternStorage } from "../lib/patterns/syncSidewaysCardiganBuilderToPatternStorage";
import { SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF } from "../lib/patterns/customPatternProjectNavigation";
import { validateSidewaysCardiganBuilder } from "../lib/patterns/sidewaysCardiganBuilderValidation";
import { formatInchesWithUnit } from "../lib/patterns/sidewaysCardiganDisplayFormat";
import {
  applySidewaysCardiganDraftToGaugeInputs,
  emptySidewaysCardiganBuilderDraftState,
  readSidewaysCardiganBuilderStateFromDraft,
  type SidewaysCardiganBuilderDraftState,
} from "../lib/patterns/sidewaysCardiganBuilderState";
import {
  emptySidewaysCardiganStyleMeasurements,
  finishedBustInchesFromChartRow,
  reseedSidewaysCardiganStyleMeasurements,
  SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS,
  styleMeasurementsAreComplete,
  type SidewaysCardiganStyleMeasurementKey,
} from "../lib/patterns/sidewaysCardiganStyleMeasurements";

const STEPS = 8;

const STYLE_INPUT_IDS: Record<SidewaysCardiganStyleMeasurementKey, string> = {
  finishedLength: "sideways-finished-length",
  vNeckDepth: "sideways-vneck-depth",
  neckOpeningWidth: "sideways-neck-opening",
  finishedUpperArm: "sideways-finished-upper-arm",
  sleeveLength: "sideways-sleeve-length",
  wrist: "sideways-wrist",
};

type BuilderState = SidewaysCardiganBuilderDraftState;

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clearStaleActiveProjectLink(): void {
  const activeId = readActiveCustomPatternProjectId();
  if (!activeId) return;
  const baseline = readHydratedConstructionBaseline();
  if (!baseline || baseline.projectId !== activeId) {
    clearActiveCustomPatternProjectId();
    return;
  }
  if (baseline.hadAuthoritativeDropShoulder) {
    clearActiveCustomPatternProjectId();
  }
}

function currentChartRow(state: BuilderState): SidewaysCardiganWomenChartRow | null {
  if (!state.chartAudience || !state.selectedSize) return null;
  return findSidewaysCardiganWomenChartRow(state.selectedSize, state.chartAudience);
}

function readStateFromDraft(): BuilderState {
  try {
    return readSidewaysCardiganBuilderStateFromDraft();
  } catch {
    return emptySidewaysCardiganBuilderDraftState();
  }
}

function gaugeInputs(): { stitch: string; row: string; needles: string; unit: "in" | "cm" } {
  const st = document.getElementById(EXPRESS_GAUGE_STITCH_INPUT_ID);
  const rw = document.getElementById(EXPRESS_GAUGE_ROW_INPUT_ID);
  const nd = document.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID);
  return {
    stitch: st instanceof HTMLInputElement ? st.value.trim() : "",
    row: rw instanceof HTMLInputElement ? rw.value.trim() : "",
    needles: nd instanceof HTMLInputElement ? nd.value.trim() : "",
    unit: getExpressUiUnit(),
  };
}

function persist(state: BuilderState): void {
  stampSidewaysCardiganWorkingDraftFromPage({
    sleeveDirection: state.sleeveDirection,
    garmentStyle: state.garmentStyle,
  });
  const row = currentChartRow(state);
  if (!row || !state.fit || !state.chartAudience) return;
  const g = gaugeInputs();
  syncSidewaysCardiganBuilderToPatternStorage(
    {
      selectedSize: state.selectedSize,
      chartAudience: state.chartAudience,
      fit: state.fit,
      vNeckDepthInches: state.styleMeasurements.vNeckDepth,
      styleMeasurements: state.styleMeasurements,
      gaugeStitchRaw: g.stitch,
      gaugeRowRaw: g.row,
      availableNeedles: g.needles,
      unit: g.unit,
      sleeveDirection: state.sleeveDirection,
      garmentStyle: state.garmentStyle,
    },
    row,
  );
  stampSidewaysCardiganWorkingDraftFromPage({
    sleeveDirection: state.sleeveDirection,
    garmentStyle: state.garmentStyle,
  });
}

function renderSizeTable(state: BuilderState): void {
  const tbody = document.querySelector("[data-sideways-size-table-body]");
  if (!(tbody instanceof HTMLElement)) return;
  tbody.replaceChildren();
  if (!state.chartAudience) return;
  const unit = getExpressUiUnit();
  const rows = getSidewaysCardiganChartRowsForAudience(state.chartAudience);
  for (const row of rows) {
    const sz = normalizeChartRowSize(row);
    if (!sz) continue;
    const meas = formatBustChestDisplay(row, unit);
    const selected = state.selectedSize === sz;
    const tr = document.createElement("tr");
    tr.className = `express-size-row${selected ? " is-selected" : ""}`;
    tr.setAttribute("data-sideways-size-row", "");
    tr.setAttribute("data-value", sz);
    tr.setAttribute("role", "radio");
    tr.setAttribute("aria-checked", selected ? "true" : "false");
    tr.setAttribute("tabindex", "0");
    tr.innerHTML = `<td class="express-size-row__size"><span class="express-size-row__check" aria-hidden="true">${
      selected ? "✓" : ""
    }</span><span class="express-size-row__size-label">${escapeHtml(sz)}</span></td><td class="express-size-row__measure"><span class="express-size-row__measure-value">${escapeHtml(
      meas,
    )}</span></td>`;
    tbody.appendChild(tr);
  }
}

function renderBodySummary(state: BuilderState): void {
  const el = document.querySelector("[data-express-size-standard-body-summary]");
  if (!(el instanceof HTMLElement)) return;
  const row = currentChartRow(state);
  if (!row || !state.selectedSize) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  const summary = buildExpressStandardBodyMeasurementsSummaryFromRow(
    state.selectedSize,
    row,
    getExpressUiUnit(),
  );
  const items = summary.measurements
    .map(
      ({ label, value }) =>
        `<div class="express-size-standard-body-summary__item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  el.innerHTML = `<h3 class="express-size-standard-body-summary__heading">${escapeHtml(
    summary.heading,
  )}</h3><dl class="express-size-standard-body-summary__list">${items}</dl>`;
  el.hidden = false;
}

function setSummary(field: string, text: string): void {
  document.querySelectorAll(`[data-express-summary="${field}"]`).forEach((el) => {
    el.textContent = text;
  });
}

function syncStyleInputs(state: BuilderState): void {
  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    const input = document.getElementById(STYLE_INPUT_IDS[key]);
    if (!(input instanceof HTMLInputElement)) continue;
    if (document.activeElement === input) continue;
    input.value = state.styleMeasurements[key];
  }
}

function readStyleInputsIntoState(state: BuilderState, markEdited?: SidewaysCardiganStyleMeasurementKey): void {
  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    const input = document.getElementById(STYLE_INPUT_IDS[key]);
    if (!(input instanceof HTMLInputElement)) continue;
    state.styleMeasurements[key] = input.value.trim();
  }
  if (markEdited) state.userEditedStyle[markEdited] = true;
}

function applyChartDefaults(state: BuilderState): void {
  const row = currentChartRow(state);
  if (!row || !state.chartAudience || !state.fit) return;
  state.styleMeasurements = reseedSidewaysCardiganStyleMeasurements({
    previous: state.styleMeasurements,
    userEdited: state.userEditedStyle,
    row,
    chartAudience: state.chartAudience,
    fitPreference: state.fit,
  });
}

function finishedBustForState(state: BuilderState): number | undefined {
  const row = currentChartRow(state);
  if (!row || !state.fit) return undefined;
  return finishedBustInchesFromChartRow(row, state.fit);
}

function renderFinishedBust(state: BuilderState): void {
  const el = document.querySelector("[data-sideways-finished-bust]");
  if (!(el instanceof HTMLElement)) return;
  const bust = finishedBustForState(state);
  if (!bust) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = `Finished bust: ${formatInchesWithUnit(bust)}`;
}

function renderReview(state: BuilderState): void {
  const host = document.querySelector("[data-sideways-review-summary]");
  if (!(host instanceof HTMLElement)) return;
  const chartLabel = sidewaysCardiganChartAudienceDisplayLabel(state.chartAudience);
  const bust = finishedBustForState(state);
  const rows: Array<[string, string]> = [
    ["Garment style", SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[state.garmentStyle]],
    ["Sizing chart", chartLabel],
    ["Size", state.selectedSize ? `Size ${state.selectedSize}` : ""],
    ["Fit", state.fit ? `${state.fit.charAt(0).toUpperCase()}${state.fit.slice(1)}` : ""],
    ["Finished bust", bust ? formatInchesWithUnit(bust) : ""],
    ["Finished garment length", state.styleMeasurements.finishedLength ? `${state.styleMeasurements.finishedLength} in` : ""],
    ["V-neck depth", state.styleMeasurements.vNeckDepth ? `${state.styleMeasurements.vNeckDepth} in` : ""],
    ["Neck-opening width", state.styleMeasurements.neckOpeningWidth ? `${state.styleMeasurements.neckOpeningWidth} in` : ""],
    ["Finished upper arm", state.styleMeasurements.finishedUpperArm ? `${state.styleMeasurements.finishedUpperArm} in` : ""],
    ["Sleeve length", state.styleMeasurements.sleeveLength ? `${state.styleMeasurements.sleeveLength} in` : ""],
    ["Wrist", state.styleMeasurements.wrist ? `${state.styleMeasurements.wrist} in` : ""],
    ["Sleeve direction", SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[state.sleeveDirection]],
  ];
  host.replaceChildren();
  for (const [term, def] of rows) {
    if (!def) continue;
    const wrap = document.createElement("div");
    wrap.className = "print-summary-dl__pair";
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = def;
    wrap.append(dt, dd);
    host.append(wrap);
  }
}

function showBuilderError(message: string | null): void {
  const el = document.querySelector("[data-sideways-builder-error]");
  if (!(el instanceof HTMLElement)) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function gaugePerInch(): { spi?: number; rpi?: number } {
  const g = gaugeInputs();
  if (!(Number(g.stitch) > 0) || !(Number(g.row) > 0)) return {};
  const converted = rawSwatchToPerInch(g.stitch, g.row, g.unit);
  const spi = Number(converted.gaugeStitchesPerInch);
  const rpi = Number(converted.gaugeRowsPerInch);
  return {
    spi: spi > 0 ? spi : undefined,
    rpi: rpi > 0 ? rpi : undefined,
  };
}

function canOpen(state: BuilderState, step: number): boolean {
  if (step <= 1) return true;
  if (step === 2) return true;
  if (!state.chartAudience) return false;
  if (step === 3) return true;
  if (!state.selectedSize) return false;
  if (step === 4) return true;
  if (!state.fit) return false;
  if (step === 5) return true;
  if (!styleMeasurementsAreComplete(state.styleMeasurements)) return false;
  if (step === 6 || step === 7) return true;
  const g = gaugeInputs();
  return Number(g.stitch) > 0 && Number(g.row) > 0;
}

function refreshUi(state: BuilderState, openStep: number): void {
  renderSizeTable(state);
  renderBodySummary(state);
  renderFinishedBust(state);
  renderReview(state);
  syncStyleInputs(state);

  const chartLabel = sidewaysCardiganChartAudienceDisplayLabel(state.chartAudience);
  setSummary("garmentStyle", SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[state.garmentStyle]);
  setSummary("chartAudience", chartLabel);
  setSummary(
    "selectedSize",
    state.selectedSize ? `Size ${state.selectedSize}${chartLabel ? ` · ${chartLabel}` : ""}` : "",
  );
  setSummary("fit", state.fit ? `${state.fit.charAt(0).toUpperCase()}${state.fit.slice(1)} fit` : "");
  setSummary(
    "measurements",
    styleMeasurementsAreComplete(state.styleMeasurements) ? "Set" : "",
  );
  setSummary("sleeveDirection", SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[state.sleeveDirection]);

  document.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((btn) => {
    const field = btn.getAttribute("data-field");
    const value = btn.getAttribute("data-value");
    const on =
      (field === "garmentStyle" && value === state.garmentStyle) ||
      (field === "chartAudience" && value === state.chartAudience) ||
      (field === "fit" && value === state.fit) ||
      (field === "sleeveDirection" && value === state.sleeveDirection);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  for (let step = 1; step <= STEPS; step++) {
    const sec = document.querySelector(`[data-express-step="${step}"]`);
    if (!(sec instanceof HTMLElement)) continue;
    const isOpen = step === openStep;
    sec.classList.toggle("express-acc--open", isOpen);
    sec.classList.toggle("express-acc--locked", step > 1 && !canOpen(state, step));
    const panel = document.getElementById(`express-acc-panel-${step}`);
    if (panel) panel.hidden = !isOpen;
    const header = sec.querySelector("[data-express-header]");
    header?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  const g = gaugeInputs();
  const gaugeOk = Number(g.stitch) > 0 && Number(g.row) > 0;
  syncExpressNeedleBlockVisibility(document, gaugeOk);
  const wrap = document.getElementById("express-generate-wrap");
  if (wrap) {
    wrap.hidden = !(
      state.chartAudience &&
      state.selectedSize &&
      state.fit &&
      styleMeasurementsAreComplete(state.styleMeasurements) &&
      gaugeOk
    );
  }
}

function init(): void {
  applySleevelessExpressNewSessionFromUrl();
  clearStaleActiveProjectLink();
  stampSidewaysCardiganWorkingDraftFromPage();

  const state = readStateFromDraft();
  applySidewaysCardiganDraftToGaugeInputs(state);
  let openStep = 1;

  void loadExpressSweaterCharts()
    .then(() => {
      const status = document.querySelector("[data-express-size-status]");
      if (status instanceof HTMLElement) status.hidden = true;
      const wrap = document.querySelector("[data-express-size-select-wrap]");
      if (wrap instanceof HTMLElement) wrap.removeAttribute("hidden");
      if (
        state.chartAudience &&
        state.fit &&
        state.selectedSize &&
        !styleMeasurementsAreComplete(state.styleMeasurements)
      ) {
        applyChartDefaults(state);
      }
      refreshUi(state, openStep);
    })
    .catch(() => {
      const status = document.querySelector("[data-express-size-status]");
      if (status) status.textContent = "Could not load size charts.";
    });

  const root = document.querySelector("[data-express-builder]");
  root?.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const sizeRow = target.closest("[data-sideways-size-row]");
    if (sizeRow instanceof HTMLElement && state.chartAudience) {
      const sz = sizeRow.getAttribute("data-value")?.trim() ?? "";
      if (!sz) return;
      state.selectedSize = sz;
      if (state.fit) applyChartDefaults(state);
      persist(state);
      openStep = 4;
      refreshUi(state, openStep);
      return;
    }
    const choice = target.closest<HTMLButtonElement>("[data-choice]");
    if (!choice) return;
    const field = choice.getAttribute("data-field");
    const value = choice.getAttribute("data-value") ?? "";
    if (field === "garmentStyle") {
      const style = parseSidewaysCardiganGarmentStyle(value);
      if (!style) return;
      state.garmentStyle = style;
      persist(state);
      openStep = 2;
      refreshUi(state, openStep);
      return;
    }
    if (field === "chartAudience" && (value === "misses" || value === "plus")) {
      if (state.chartAudience !== value) {
        state.chartAudience = value;
        state.selectedSize = "";
        state.userEditedStyle = {};
        state.styleMeasurements = emptySidewaysCardiganStyleMeasurements();
      }
      persist(state);
      openStep = 3;
      refreshUi(state, openStep);
      return;
    }
    if (field === "fit" && (value === "close" || value === "standard" || value === "relaxed")) {
      state.fit = value;
      applyChartDefaults(state);
      persist(state);
      openStep = 5;
      refreshUi(state, openStep);
      return;
    }
    if (field === "sleeveDirection") {
      const dir = parseSidewaysCardiganSleeveDirection(value);
      if (!dir) return;
      state.sleeveDirection = dir;
      persist(state);
      openStep = 7;
      refreshUi(state, openStep);
    }
  });

  for (const key of SIDEWAYS_CARDIGAN_STYLE_MEASUREMENT_KEYS) {
    const input = document.getElementById(STYLE_INPUT_IDS[key]);
    input?.addEventListener("change", () => {
      readStyleInputsIntoState(state, key);
      persist(state);
      refreshUi(state, openStep);
    });
  }

  document.querySelectorAll("[data-express-header]").forEach((h) => {
    h.addEventListener("click", () => {
      const sec = h.closest("[data-express-step]");
      const step = parseInt(sec?.getAttribute("data-express-step") ?? "0", 10);
      if (!canOpen(state, step)) return;
      openStep = openStep === step ? 0 : step;
      refreshUi(state, openStep);
    });
  });

  document.querySelectorAll("[data-pill-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.getAttribute("data-pill-step") ?? "0", 10);
      if (!canOpen(state, step)) return;
      openStep = step;
      refreshUi(state, openStep);
    });
  });

  document.getElementById("express-start-over-btn")?.addEventListener("click", () => {
    startFreshSleevelessExpressPattern();
    stampSidewaysCardiganWorkingDraftFromPage();
    window.location.assign("/patterns/sideways-cardigan/builder?new=1");
  });

  document.getElementById(EXPRESS_GAUGE_STITCH_INPUT_ID)?.addEventListener("input", () => persist(state));
  document.getElementById(EXPRESS_GAUGE_ROW_INPUT_ID)?.addEventListener("input", () => persist(state));
  document.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID)?.addEventListener("input", () => persist(state));
  document.getElementById(EXPRESS_GAUGE_STITCH_INPUT_ID)?.addEventListener("change", () => {
    persist(state);
    refreshUi(state, openStep);
  });
  document.getElementById(EXPRESS_GAUGE_ROW_INPUT_ID)?.addEventListener("change", () => {
    persist(state);
    refreshUi(state, openStep);
  });

  document.querySelectorAll<HTMLElement>("[data-sg-fit-ease]").forEach((el) => {
    const key = el.getAttribute("data-sg-fit-ease");
    if (key === "close" || key === "standard" || key === "relaxed") {
      el.textContent = formatFitEaseApproxLabel(key);
    }
  });

  wireExpressBuilderReviewSubmit({
    openGaugeStepForValidation: () => {
      openStep = 7;
      refreshUi(state, openStep);
    },
    onProceed: () => {
      readStyleInputsIntoState(state);
      const g = gaugeInputs();
      const perInch = gaugePerInch();
      const bust = finishedBustForState(state);
      const error = validateSidewaysCardiganBuilder({
        chartAudience: state.chartAudience,
        selectedSize: state.selectedSize,
        fit: state.fit,
        sleeveDirection: state.sleeveDirection,
        garmentStyle: state.garmentStyle,
        finishedLengthInches: state.styleMeasurements.finishedLength,
        vNeckDepthInches: state.styleMeasurements.vNeckDepth,
        neckOpeningWidthInches: state.styleMeasurements.neckOpeningWidth,
        finishedUpperArmInches: state.styleMeasurements.finishedUpperArm,
        sleeveLengthInches: state.styleMeasurements.sleeveLength,
        wristInches: state.styleMeasurements.wrist,
        finishedBustInches: bust,
        stitchesPerInch: perInch.spi,
        rowsPerInch: perInch.rpi,
        availableNeedles: g.needles,
      });
      if (error) {
        showBuilderError(error.message);
        openStep = 8;
        refreshUi(state, openStep);
        return;
      }
      showBuilderError(null);
      persist(state);
      window.location.assign(SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF);
    },
  });

  refreshUi(state, openStep);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  queueMicrotask(init);
}

window.addEventListener("pagehide", () => {
  stampSidewaysCardiganWorkingDraftFromPage();
});
