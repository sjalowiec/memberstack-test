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
  formatBustChestDisplay,
  getExpressUiUnit,
  loadExpressSweaterCharts,
  normalizeChartRowSize,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import { formatSwatchCountForGaugeInput } from "../lib/patterns/gaugeDisplayFormat";
import { formatFitEaseApproxLabel } from "../lib/patterns/fitEaseInches";
import {
  buildSidewaysCardiganWomenChartRows,
  findSidewaysCardiganWomenChartRow,
  type SidewaysCardiganWomenChartRow,
} from "../lib/patterns/sidewaysCardiganSizeCharts";
import {
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import { syncSidewaysCardiganBuilderToPatternStorage } from "../lib/patterns/syncSidewaysCardiganBuilderToPatternStorage";
import { SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF } from "../lib/patterns/customPatternProjectNavigation";
import { getCurrentPattern } from "../lib/patterns/patternStorage";

const STEPS = 4;

type BuilderState = {
  selectedSize: string;
  fit: string;
  vNeckDepthInches: string;
};

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

function readStateFromDraft(): BuilderState {
  try {
    const pattern = getCurrentPattern();
    const fit = (pattern.fit ?? {}) as Record<string, unknown>;
    const sm = (fit.selectedMeasurements ?? {}) as Record<string, unknown>;
    const overrides = (fit.cbMeasurementOverrides ?? {}) as Record<string, unknown>;
    const selectedSize = String(fit.selectedSize ?? "").trim();
    const ease = String(fit.easeChoice ?? fit.fitChoice ?? "").trim();
    const vNeck = String(overrides.neckDepth ?? sm.front_neck_depth ?? "").trim();
    return {
      selectedSize,
      fit: ease === "close" || ease === "relaxed" || ease === "standard" ? ease : "",
      vNeckDepthInches: vNeck,
    };
  } catch {
    return { selectedSize: "", fit: "", vNeckDepthInches: "" };
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
  const row = findSidewaysCardiganWomenChartRow(state.selectedSize);
  if (!row || !state.fit) return;
  const g = gaugeInputs();
  syncSidewaysCardiganBuilderToPatternStorage(
    {
      selectedSize: state.selectedSize,
      chartAudience: row.chartAudience,
      fit: state.fit,
      vNeckDepthInches: state.vNeckDepthInches,
      gaugeStitchRaw: g.stitch,
      gaugeRowRaw: g.row,
      availableNeedles: g.needles,
      unit: g.unit,
    },
    row,
  );
  stampSidewaysCardiganWorkingDraftFromPage();
}

function renderSizeTable(state: BuilderState): void {
  const tbody = document.querySelector("[data-sideways-size-table-body]");
  if (!(tbody instanceof HTMLElement)) return;
  const unit = getExpressUiUnit();
  const rows = buildSidewaysCardiganWomenChartRows();
  tbody.replaceChildren();
  let lastAudience = "";
  for (const row of rows) {
    const sz = normalizeChartRowSize(row);
    if (!sz) continue;
    if (row.chartAudience !== lastAudience) {
      lastAudience = row.chartAudience;
      const group = document.createElement("tr");
      group.className = "express-size-row express-size-row--group";
      group.innerHTML = `<th colspan="2" scope="colgroup">${escapeHtml(
        row.chartAudience === "plus" ? "Plus" : "Misses",
      )}</th>`;
      tbody.appendChild(group);
    }
    const meas = formatBustChestDisplay(row, unit);
    const selected = state.selectedSize === sz;
    const tr = document.createElement("tr");
    tr.className = `express-size-row${selected ? " is-selected" : ""}`;
    tr.setAttribute("data-sideways-size-row", "");
    tr.setAttribute("data-value", sz);
    tr.setAttribute("data-chart-audience", row.chartAudience);
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

function defaultVNeckFromRow(row: SidewaysCardiganWomenChartRow | null): string {
  const n = Number(row?.front_neck_depth);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatSwatchCountForGaugeInput(n);
}

function setSummary(field: string, text: string): void {
  document.querySelectorAll(`[data-express-summary="${field}"]`).forEach((el) => {
    el.textContent = text;
  });
}

function refreshUi(state: BuilderState, openStep: number): void {
  renderSizeTable(state);
  const row = findSidewaysCardiganWomenChartRow(state.selectedSize);
  const sizeLabel = state.selectedSize
    ? `Size ${state.selectedSize}${row ? ` · ${row.chartAudience === "plus" ? "Plus" : "Misses"}` : ""}`
    : "";
  setSummary("selectedSize", sizeLabel);
  setSummary("fit", state.fit ? `${state.fit.charAt(0).toUpperCase()}${state.fit.slice(1)} fit` : "");
  setSummary("vNeckDepth", state.vNeckDepthInches ? `${state.vNeckDepthInches}″` : "");

  const vInput = document.querySelector<HTMLInputElement>("#sideways-vneck-depth");
  if (vInput && document.activeElement !== vInput) {
    vInput.value = state.vNeckDepthInches;
  }

  document.querySelectorAll<HTMLButtonElement>("[data-choice][data-field='fit']").forEach((btn) => {
    const on = btn.getAttribute("data-value") === state.fit;
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
  if (wrap) wrap.hidden = !(state.selectedSize && state.fit && Number(state.vNeckDepthInches) > 0 && gaugeOk);
}

function canOpen(state: BuilderState, step: number): boolean {
  if (step <= 1) return true;
  if (!state.selectedSize) return false;
  if (step === 2) return true;
  if (!(Number(state.vNeckDepthInches) > 0)) return false;
  if (step === 3) return true;
  return Boolean(state.fit);
}

function init(): void {
  applySleevelessExpressNewSessionFromUrl();
  clearStaleActiveProjectLink();
  stampSidewaysCardiganWorkingDraftFromPage();

  const state = readStateFromDraft();
  let openStep = 1;

  void loadExpressSweaterCharts()
    .then(() => {
      const status = document.querySelector("[data-express-size-status]");
      if (status instanceof HTMLElement) status.hidden = true;
      const wrap = document.querySelector("[data-express-size-select-wrap]");
      if (wrap instanceof HTMLElement) wrap.removeAttribute("hidden");
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
    if (sizeRow instanceof HTMLElement) {
      const sz = sizeRow.getAttribute("data-value")?.trim() ?? "";
      if (!sz) return;
      state.selectedSize = sz;
      const row = findSidewaysCardiganWomenChartRow(sz);
      if (!state.vNeckDepthInches) state.vNeckDepthInches = defaultVNeckFromRow(row);
      persist(state);
      openStep = 2;
      refreshUi(state, openStep);
      return;
    }
    const fitBtn = target.closest<HTMLButtonElement>("[data-choice][data-field='fit']");
    if (fitBtn) {
      const v = fitBtn.getAttribute("data-value") ?? "";
      if (v === "close" || v === "standard" || v === "relaxed") {
        state.fit = v;
        persist(state);
        openStep = 4;
        refreshUi(state, openStep);
      }
    }
  });

  const vInput = document.querySelector<HTMLInputElement>("#sideways-vneck-depth");
  vInput?.addEventListener("change", () => {
    state.vNeckDepthInches = vInput.value.trim();
    persist(state);
    refreshUi(state, openStep);
  });

  document.querySelectorAll("[data-express-header]").forEach((h) => {
    h.addEventListener("click", () => {
      const sec = h.closest("[data-express-step]");
      const step = parseInt(sec?.getAttribute("data-express-step") ?? "0", 10);
      if (!canOpen(state, step)) return;
      openStep = openStep === step ? 0 : step;
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
      openStep = 4;
      refreshUi(state, openStep);
    },
    onProceed: () => {
      if (!state.selectedSize || !state.fit || !(Number(state.vNeckDepthInches) > 0)) {
        window.alert("Please choose a size, V-neck depth, and fit before generating.");
        return;
      }
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
