/**
 * Sideways V-Neck Sweater workspace — calculation summary plus temporary numeric
 * body and cuff-up / top-down sleeve sequences. Does not generate Drop Shoulder /
 * Sleeveless instructions. Sideways-knit sleeves are not substituted.
 */
import {
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import {
  loadSidewaysCardiganWorkspaceView,
} from "../lib/patterns/sidewaysCardiganWorkspaceLoad";
import { readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { runSaveCustomPatternFromWorkspace } from "../lib/patterns/customPatternEditingBannerActions";
import { readSidewaysCardiganBuilderStateFromDraft } from "../lib/patterns/sidewaysCardiganBuilderState";
import { sidewaysCardiganChartAudienceDisplayLabel } from "../lib/patterns/sidewaysCardiganSizeCharts";
import {
  applySidewaysCardiganSummaryMeasurementEdits,
  SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS,
} from "../lib/patterns/sidewaysCardiganSummaryEdit";
import {
  type SidewaysCardiganStyleMeasurementKey,
  type SidewaysCardiganStyleMeasurements,
} from "../lib/patterns/sidewaysCardiganStyleMeasurements";

function renderView(): void {
  stampSidewaysCardiganWorkingDraftFromPage();

  const missing = document.querySelector("[data-sideways-calc-missing]");
  const host = document.querySelector("[data-sideways-calc-host]");
  const summary = document.querySelector("[data-sideways-calc-summary]");
  const errorEl = document.querySelector("[data-sideways-calc-error]");
  const adjustmentEl = document.querySelector("[data-sideways-calc-adjustment]");
  const sequenceEl = document.querySelector("[data-sideways-body-sequence]");
  const sleeveHost = document.querySelector("[data-sideways-sleeve-host]");
  const sleeveEl = document.querySelector("[data-sideways-sleeve-sequence]");
  const sleeveErrorEl = document.querySelector("[data-sideways-sleeve-error]");
  if (
    !(summary instanceof HTMLElement) ||
    !(missing instanceof HTMLElement) ||
    !(host instanceof HTMLElement)
  ) {
    return;
  }

  const showDiagnostic = (message: string): void => {
    missing.hidden = false;
    missing.textContent = message;
    host.hidden = true;
    summary.innerHTML = "";
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
    if (sleeveHost instanceof HTMLElement) sleeveHost.hidden = true;
    if (sleeveEl instanceof HTMLElement) sleeveEl.innerHTML = "";
    if (sleeveErrorEl instanceof HTMLElement) {
      sleeveErrorEl.hidden = true;
      sleeveErrorEl.textContent = "";
    }
  };

  let view;
  try {
    view = loadSidewaysCardiganWorkspaceView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showDiagnostic(
      import.meta.env.DEV
        ? `[DEV] Sideways V-Neck Sweater workspace failed to load: ${detail}`
        : "This Sideways V-Neck Sweater could not be loaded from the saved draft.",
    );
    return;
  }

  if (!view.ok) {
    showDiagnostic(view.message);
    return;
  }

  missing.hidden = true;
  missing.textContent = "";
  host.hidden = false;
  if (errorEl instanceof HTMLElement) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  summary.innerHTML = view.summaryHtml;

  if (adjustmentEl instanceof HTMLElement) {
    if (view.summary.adjustmentMessage) {
      adjustmentEl.hidden = false;
      adjustmentEl.textContent = `Bust adjusted to keep the pattern symmetrical: ${view.summary.adjustmentMessage}.`;
    } else {
      adjustmentEl.hidden = true;
      adjustmentEl.textContent = "";
    }
  }

  if (sequenceEl instanceof HTMLElement) {
    if (view.instructionError) {
      sequenceEl.replaceChildren();
      const note = document.createElement("p");
      note.className = "sg-fit-size-copy";
      note.textContent = view.instructionError;
      sequenceEl.append(note);
    } else {
      sequenceEl.innerHTML = view.sequenceHtml;
    }
  }

  const hasSleeveContent = Boolean(view.sleeveHtml) || Boolean(view.sleeveError);
  if (sleeveHost instanceof HTMLElement) {
    sleeveHost.hidden = !hasSleeveContent;
  }
  if (sleeveErrorEl instanceof HTMLElement) {
    if (view.sleeveError) {
      sleeveErrorEl.hidden = false;
      sleeveErrorEl.textContent = view.sleeveError;
    } else {
      sleeveErrorEl.hidden = true;
      sleeveErrorEl.textContent = "";
    }
  }
  if (sleeveEl instanceof HTMLElement) {
    sleeveEl.innerHTML = view.sleeveError ? "" : view.sleeveHtml;
  }
}

function readMeasurementInputs(): Partial<SidewaysCardiganStyleMeasurements> {
  const edits: Partial<SidewaysCardiganStyleMeasurements> = {};
  for (const field of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS) {
    const id = field.id as SidewaysCardiganStyleMeasurementKey;
    if (!field.inputDataAttr) continue;
    const input = document.querySelector(`[${field.inputDataAttr}]`);
    if (!(input instanceof HTMLInputElement)) continue;
    edits[id] = input.value.trim();
  }
  return edits;
}

function fillSummaryEditForm(): void {
  const state = readSidewaysCardiganBuilderStateFromDraft();
  for (const field of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS) {
    const id = field.id as SidewaysCardiganStyleMeasurementKey;
    if (!field.inputDataAttr) continue;
    const input = document.querySelector(`[${field.inputDataAttr}]`);
    if (!(input instanceof HTMLInputElement)) continue;
    input.value = state.styleMeasurements[id] ?? "";
  }
  const choices = document.querySelector("[data-sideways-edit-choices]");
  if (!(choices instanceof HTMLElement)) return;
  const chartLabel = sidewaysCardiganChartAudienceDisplayLabel(state.chartAudience);
  const rows: Array<[string, string]> = [
    ["Garment style", SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[state.garmentStyle]],
    [
      "Starting size",
      state.selectedSize
        ? chartLabel
          ? `Size ${state.selectedSize} · ${chartLabel}`
          : `Size ${state.selectedSize}`
        : "",
    ],
    ["Fit", state.fit ? `${state.fit.charAt(0).toUpperCase()}${state.fit.slice(1)}` : ""],
    ["Sleeve direction", SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[state.sleeveDirection]],
  ];
  choices.replaceChildren();
  for (const [term, def] of rows) {
    if (!def) continue;
    const wrap = document.createElement("div");
    wrap.className = "print-summary-dl__pair";
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = def;
    wrap.append(dt, dd);
    choices.append(wrap);
  }
}

function showEditError(message: string | null): void {
  const el = document.querySelector("[data-sl-edit-errors]");
  if (!(el instanceof HTMLElement)) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function showEditSaved(visible: boolean): void {
  const el = document.querySelector("[data-sl-edit-note]");
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function wireSummaryEdit(): void {
  const drawer = document.querySelector("[data-sl-edit-drawer]");
  if (!(drawer instanceof HTMLElement)) return;
  const panel = document.getElementById("sl-edit-drawer-panel");
  let snapshot: SidewaysCardiganStyleMeasurements | null = null;

  const open = (): void => {
    snapshot = { ...readSidewaysCardiganBuilderStateFromDraft().styleMeasurements };
    fillSummaryEditForm();
    showEditError(null);
    showEditSaved(false);
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    panel?.focus();
  };

  const close = (restore: boolean): void => {
    if (restore && snapshot) {
      applySidewaysCardiganSummaryMeasurementEdits(snapshot);
      renderView();
    }
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    showEditError(null);
    showEditSaved(false);
  };

  document.querySelector("[data-sl-edit-open]")?.addEventListener("click", () => open());
  drawer.querySelectorAll("[data-sl-edit-close]").forEach((el) => {
    el.addEventListener("click", () => close(true));
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && drawer.classList.contains("is-open")) {
      close(true);
    }
  });
  document.querySelector("[data-sl-edit-apply]")?.addEventListener("click", () => {
    void (async () => {
      const before = readSidewaysCardiganBuilderStateFromDraft();
      const garmentStyle = before.garmentStyle;
      const sleeveDirection = before.sleeveDirection;
      const result = applySidewaysCardiganSummaryMeasurementEdits(readMeasurementInputs());
      if (!result.ok) {
        showEditError(result.message);
        return;
      }
      const after = readSidewaysCardiganBuilderStateFromDraft();
      if (after.garmentStyle !== garmentStyle || after.sleeveDirection !== sleeveDirection) {
        showEditError("Cardigan/Pullover and sleeve direction must stay unchanged.");
        return;
      }
      snapshot = { ...after.styleMeasurements };
      const activeId = readActiveCustomPatternProjectId();
      if (activeId) {
        const saveRes = await runSaveCustomPatternFromWorkspace(undefined, {
          skipPreSavePrepare: true,
          activeProjectId: activeId,
        });
        if (!saveRes.ok) {
          showEditError(saveRes.error);
          return;
        }
      }
      renderView();
      showEditError(null);
      showEditSaved(true);
    })();
  });
}

function boot(): void {
  try {
    renderView();
    wireSummaryEdit();
  } catch (error) {
    const missing = document.querySelector("[data-sideways-calc-missing]");
    if (missing instanceof HTMLElement) {
      missing.hidden = false;
      const detail = error instanceof Error ? error.message : String(error);
      missing.textContent = import.meta.env.DEV
        ? `[DEV] Sideways V-Neck Sweater workspace failed to load: ${detail}`
        : "This Sideways V-Neck Sweater could not be loaded from the saved draft.";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
