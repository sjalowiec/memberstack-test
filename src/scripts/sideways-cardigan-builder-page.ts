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
  getSidewaysCardiganChartRowsForAudience,
  SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS,
  sidewaysCardiganChartAudienceDisplayLabel,
  type SidewaysCardiganWomenChartAudience,
  type SidewaysCardiganWomenChartRow,
} from "../lib/patterns/sidewaysCardiganSizeCharts";
import {
  parseSidewaysCardiganGarmentStyle,
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import { syncSidewaysCardiganBuilderToPatternStorage } from "../lib/patterns/syncSidewaysCardiganBuilderToPatternStorage";
import { SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF } from "../lib/patterns/customPatternProjectNavigation";
import { validateSidewaysCardiganBuilder } from "../lib/patterns/sidewaysCardiganBuilderValidation";
import { formatInchesWithUnit } from "../lib/patterns/sidewaysCardiganDisplayFormat";
import {
  applySidewaysCardiganDraftToGaugeInputs,
  applySidewaysCardiganSleeveChoice,
  applySidewaysCardiganStartingChartSelection,
  emptySidewaysCardiganBuilderDraftState,
  isSidewaysCardiganSleeveStepComplete,
  readSidewaysCardiganBuilderStateFromDraft,
  writeSidewaysCardiganSizingIdentity,
  type SidewaysCardiganBuilderDraftState,
} from "../lib/patterns/sidewaysCardiganBuilderState";
import {
  emptySidewaysCardiganStyleMeasurements,
  finishedBustInchesFromChartRow,
  reseedSidewaysCardiganStyleMeasurements,
  styleMeasurementsAreComplete,
} from "../lib/patterns/sidewaysCardiganStyleMeasurements";

const STEPS = 5;
const LOCKED_STEP_NAV_TITLE = "Finish the previous step to continue.";

type BuilderState = SidewaysCardiganBuilderDraftState;

let showingReview = false;

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
  const rows = getSidewaysCardiganChartRowsForAudience(state.chartAudience);
  return rows.find((row) => normalizeChartRowSize(row) === state.selectedSize) ?? null;
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
    sleeveLength: state.sleeveLengthChoice,
  });
  const row = currentChartRow(state);
  if (row && state.fit && state.chartAudience) {
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
        sleeveLengthChoice: state.sleeveLengthChoice,
        garmentStyle: state.garmentStyle,
      },
      row,
    );
    stampSidewaysCardiganWorkingDraftFromPage({
      sleeveDirection: state.sleeveDirection,
      garmentStyle: state.garmentStyle,
      sleeveLength: state.sleeveLengthChoice,
    });
    return;
  }
  writeSidewaysCardiganSizingIdentity({
    chartAudience: state.chartAudience,
    selectedSize: state.selectedSize,
  });
}

function renderSizeTable(state: BuilderState): void {
  const nested = document.querySelector("[data-express-nested-size]");
  if (nested instanceof HTMLElement) nested.hidden = !state.chartAudience;
  const unit = getExpressUiUnit();
  for (const group of SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS) {
    const section = document.querySelector(`[data-sideways-size-group="${group.audience}"]`);
    if (section instanceof HTMLElement) {
      section.hidden = state.chartAudience !== group.audience;
    }
    const tbody = document.querySelector(`[data-sideways-size-table-body="${group.audience}"]`);
    if (!(tbody instanceof HTMLElement)) continue;
    tbody.replaceChildren();
    if (state.chartAudience !== group.audience) continue;
    const rows = getSidewaysCardiganChartRowsForAudience(group.audience);
    for (const row of rows) {
      const sz = normalizeChartRowSize(row);
      if (!sz) continue;
      const meas = formatBustChestDisplay(row, unit);
      const selected = state.selectedSize === sz && state.chartAudience === group.audience;
      const tr = document.createElement("tr");
      tr.className = `express-size-row${selected ? " is-selected" : ""}`;
      tr.setAttribute("data-sideways-size-row", "");
      tr.setAttribute("data-value", sz);
      tr.setAttribute("data-chart-audience", group.audience);
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

function applyChartDefaults(state: BuilderState): void {
  const row = currentChartRow(state);
  if (!row || !state.chartAudience || !state.fit) return;
  state.styleMeasurements = reseedSidewaysCardiganStyleMeasurements({
    previous: state.styleMeasurements,
    userEdited: state.userEditedStyle,
    row,
    chartAudience: state.chartAudience,
    fitPreference: state.fit,
    sleeveLengthChoice: state.sleeveLengthChoice,
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

function startingSizeSummary(state: BuilderState): string {
  if (!state.selectedSize) return "";
  const chartLabel = sidewaysCardiganChartAudienceDisplayLabel(state.chartAudience);
  return chartLabel ? `Size ${state.selectedSize} · ${chartLabel}` : `Size ${state.selectedSize}`;
}

function renderReview(state: BuilderState): void {
  const host = document.querySelector("[data-sideways-review-summary]");
  if (!(host instanceof HTMLElement)) return;
  const bust = finishedBustForState(state);
  const g = gaugeInputs();
  const gaugeLabel =
    Number(g.stitch) > 0 && Number(g.row) > 0
      ? `${g.stitch} sts / ${g.row} rows over ${g.unit === "cm" ? "10 cm" : "4 inches"}`
      : "";
  const rows: Array<[string, string]> = [
    ["Garment style", SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[state.garmentStyle]],
    ["Starting size", startingSizeSummary(state)],
    ["Fit", state.fit ? `${state.fit.charAt(0).toUpperCase()}${state.fit.slice(1)}` : ""],
    ["Finished bust", bust ? formatInchesWithUnit(bust) : ""],
    ["Sleeve direction", state.sleeveDirection ? SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[state.sleeveDirection] : ""],
    ["Sleeve length", state.sleeveLengthChoice ? SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS[state.sleeveLengthChoice] : ""],
    ["Gauge", gaugeLabel],
    ["Machine", g.needles ? `${g.needles} needles available` : ""],
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

function gaugeOk(): boolean {
  const g = gaugeInputs();
  return Number(g.stitch) > 0 && Number(g.row) > 0;
}

function isStepComplete(state: BuilderState, step: number): boolean {
  if (step === 1) return Boolean(state.garmentStyle);
  if (step === 2) return Boolean(state.chartAudience && state.selectedSize);
  if (step === 3) return Boolean(state.fit);
  if (step === 4) return isSidewaysCardiganSleeveStepComplete(state);
  if (step === 5) return gaugeOk();
  return false;
}

function wizardReadyForReview(state: BuilderState): boolean {
  return (
    Boolean(state.chartAudience && state.selectedSize && state.fit) &&
    styleMeasurementsAreComplete(state.styleMeasurements) &&
    gaugeOk()
  );
}

function canOpen(state: BuilderState, step: number): boolean {
  if (step < 1 || step > STEPS) return false;
  if (step <= 1) return true;
  if (step === 2) return true;
  if (!state.chartAudience || !state.selectedSize) return false;
  if (step === 3) return true;
  if (!state.fit) return false;
  if (step === 4) return true;
  if (!isSidewaysCardiganSleeveStepComplete(state)) return false;
  if (step === 5) return true;
  return false;
}

function updatePills(state: BuilderState, openStep: number): void {
  document.querySelectorAll("[data-pill-step]").forEach((btn) => {
    const step = parseInt(btn.getAttribute("data-pill-step") ?? "0", 10);
    const label = btn.getAttribute("data-pill-label") || `Step ${step}`;
    const complete = isStepComplete(state, step);
    const isCurrent = !showingReview && step === openStep;
    const locked = !canOpen(state, step);
    const item = btn.closest(".sg-builder-nav__item");
    btn.classList.toggle("is-complete", complete);
    btn.classList.toggle("is-current", isCurrent);
    btn.classList.toggle("is-upcoming", locked);
    if (locked) {
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("title", LOCKED_STEP_NAV_TITLE);
      btn.setAttribute("aria-label", `${label}, locked`);
    } else {
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("title");
      if (complete) btn.setAttribute("aria-label", `${label}, completed`);
      else if (isCurrent) btn.setAttribute("aria-label", `${label}, current`);
      else btn.setAttribute("aria-label", label);
    }
    if (item) item.classList.toggle("active", isCurrent);
    if (isCurrent) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

function refreshUi(state: BuilderState, openStep: number): void {
  renderSizeTable(state);
  renderBodySummary(state);
  renderFinishedBust(state);
  renderReview(state);

  setSummary("garmentStyle", SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[state.garmentStyle]);
  setSummary("selectedSize", startingSizeSummary(state));
  setSummary("fit", state.fit ? `${state.fit.charAt(0).toUpperCase()}${state.fit.slice(1)} fit` : "");
  const sleeveSummary = [
    state.sleeveDirection ? SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[state.sleeveDirection] : "",
    state.sleeveLengthChoice ? SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS[state.sleeveLengthChoice] : "",
  ]
    .filter(Boolean)
    .join(" · ");
  setSummary("sleeve", sleeveSummary);

  document.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((btn) => {
    const field = btn.getAttribute("data-field");
    const value = btn.getAttribute("data-value");
    const on =
      (field === "garmentStyle" && value === state.garmentStyle) ||
      (field === "chartAudience" && value === state.chartAudience) ||
      (field === "fit" && value === state.fit) ||
      (field === "sleeveDirection" && value === state.sleeveDirection) ||
      (field === "sleeveLength" && value === state.sleeveLengthChoice);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  const builderRoot = document.querySelector("[data-express-builder]");
  builderRoot?.classList.toggle("is-reviewing", showingReview);
  const reviewPanel = document.querySelector("[data-sideways-review-panel]");
  if (reviewPanel instanceof HTMLElement) reviewPanel.hidden = !showingReview;

  for (let step = 1; step <= STEPS; step++) {
    const sec = document.querySelector(`[data-express-step="${step}"]`);
    if (!(sec instanceof HTMLElement)) continue;
    const isOpen = !showingReview && step === openStep;
    const locked = step > 1 && !canOpen(state, step);
    sec.classList.toggle("express-acc--open", isOpen);
    sec.classList.toggle("express-acc--locked", locked);
    sec.classList.toggle("express-acc--complete", isStepComplete(state, step));
    const panel = document.getElementById(`express-acc-panel-${step}`);
    if (panel) panel.hidden = !isOpen;
    const header = sec.querySelector("[data-express-header]");
    header?.setAttribute("aria-expanded", isOpen ? "true" : "false");
    header?.setAttribute("tabindex", locked ? "-1" : "0");
    const lockedFb = sec.querySelector("[data-express-locked-feedback]");
    if (lockedFb && !locked) lockedFb.setAttribute("hidden", "");
  }

  updatePills(state, openStep);

  const wrap = document.getElementById("express-generate-wrap");
  if (wrap) {
    wrap.hidden = showingReview || !wizardReadyForReview(state);
  }
  syncExpressNeedleBlockVisibility(document, gaugeOk());
}

function selectSize(state: BuilderState, sz: string, audience: SidewaysCardiganWomenChartAudience): void {
  if (state.chartAudience !== audience) {
    state.userEditedStyle = {};
    state.styleMeasurements = emptySidewaysCardiganStyleMeasurements();
  }
  state.chartAudience = audience;
  state.selectedSize = sz;
  if (state.fit) applyChartDefaults(state);
}

function init(): void {
  applySleevelessExpressNewSessionFromUrl();
  clearStaleActiveProjectLink();
  stampSidewaysCardiganWorkingDraftFromPage();

  const state = readStateFromDraft();
  applySidewaysCardiganDraftToGaugeInputs(state);
  let openStep = 1;
  showingReview = false;

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

  const onSizeActivate = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const sizeRow = target.closest("[data-sideways-size-row]");
    if (!(sizeRow instanceof HTMLElement)) return;
    if (ev.type === "keydown") {
      if (!(ev instanceof KeyboardEvent)) return;
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
    }
    const sz = sizeRow.getAttribute("data-value")?.trim() ?? "";
    const audienceRaw = sizeRow.getAttribute("data-chart-audience");
    if (!sz || (audienceRaw !== "misses" && audienceRaw !== "plus")) return;
    selectSize(state, sz, audienceRaw);
    persist(state);
    showingReview = false;
    openStep = 3;
    refreshUi(state, openStep);
  };

  root?.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-sideways-size-row]")) {
      onSizeActivate(ev);
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
      showingReview = false;
      openStep = 2;
      refreshUi(state, openStep);
      return;
    }
    if (field === "chartAudience" && (value === "misses" || value === "plus")) {
      applySidewaysCardiganStartingChartSelection(state, value);
      persist(state);
      showingReview = false;
      openStep = 2;
      refreshUi(state, openStep);
      return;
    }
    if (field === "fit" && (value === "close" || value === "standard" || value === "relaxed")) {
      state.fit = value;
      applyChartDefaults(state);
      persist(state);
      showingReview = false;
      openStep = 4;
      refreshUi(state, openStep);
      return;
    }
    if (field === "sleeveDirection" || field === "sleeveLength") {
      const result = applySidewaysCardiganSleeveChoice(state, field, value);
      if (field === "sleeveLength") applyChartDefaults(state);
      persist(state);
      showingReview = false;
      openStep = result.openStep;
      refreshUi(state, openStep);
    }
  });
  root?.addEventListener("keydown", onSizeActivate);

  const onHeaderActivate = (ev: Event): void => {
    const h = ev.currentTarget;
    if (!(h instanceof HTMLElement)) return;
    const sec = h.closest("[data-express-step]");
    const step = parseInt(sec?.getAttribute("data-express-step") ?? "0", 10);
    if (!canOpen(state, step)) {
      const fb = sec?.querySelector("[data-express-locked-feedback]");
      if (fb) fb.removeAttribute("hidden");
      return;
    }
    showingReview = false;
    openStep = openStep === step ? 0 : step;
    refreshUi(state, openStep);
  };

  document.querySelectorAll("[data-express-header]").forEach((h) => {
    h.addEventListener("click", onHeaderActivate);
    h.addEventListener("keydown", (ev) => {
      if (!(ev instanceof KeyboardEvent)) return;
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      onHeaderActivate(ev);
    });
  });

  document.querySelectorAll("[data-pill-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.getAttribute("data-pill-step") ?? "0", 10);
      if (!canOpen(state, step)) return;
      showingReview = false;
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

  const createPatternFromReview = (): void => {
    if (
      state.chartAudience &&
      state.fit &&
      state.selectedSize &&
      !styleMeasurementsAreComplete(state.styleMeasurements)
    ) {
      applyChartDefaults(state);
    }
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
      showingReview = true;
      refreshUi(state, openStep);
      return;
    }
    showBuilderError(null);
    persist(state);
    window.location.assign(SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF);
  };

  wireExpressBuilderReviewSubmit({
    openGaugeStepForValidation: () => {
      showingReview = false;
      openStep = 5;
      refreshUi(state, openStep);
    },
    onProceed: () => {
      persist(state);
      showingReview = true;
      refreshUi(state, openStep);
    },
  });

  document.getElementById("sideways-create-pattern")?.addEventListener("click", () => {
    createPatternFromReview();
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
