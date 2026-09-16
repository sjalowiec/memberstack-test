/**
 * Sideways V-Neck Summary/Edit page — full-page workspace.
 * Live SVG redraws from chip edits; Update Pattern persists overrides and opens
 * knitting-instruction workspace. Does not read leftover wizard garment-type storage.
 */

import { readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { runSaveCustomPatternFromWorkspace } from "../lib/patterns/customPatternEditingBannerActions";
import { applySavedPatternUnavailableMessage, ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import {
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS,
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import { readSidewaysCardiganBuilderStateFromDraft } from "../lib/patterns/sidewaysCardiganBuilderState";
import { sidewaysCardiganChartAudienceDisplayLabel } from "../lib/patterns/sidewaysCardiganSizeCharts";
import { buildSidewaysCardiganEditMeasurementDiagramSvg } from "../lib/patterns/sidewaysCardiganEditMeasurementDiagramSvg";
import {
  applySidewaysCardiganSummaryMeasurementEdits,
  buildSidewaysCardiganSummaryDiagramInput,
  displaySidewaysCardiganSummaryMeasurements,
  emptySidewaysCardiganSummaryMeasurements,
  readSidewaysCardiganSummaryMeasurements,
  SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS,
  summaryMeasurementsToInches,
  type SidewaysCardiganSummaryMeasurementKey,
  type SidewaysCardiganSummaryMeasurements,
} from "../lib/patterns/sidewaysCardiganSummaryEdit";
import {
  applyMeasurementBlueprintViewBoxAspect,
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
} from "../lib/patterns/patternSummaryMeasurementOverlay";
import {
  resolveSavedPatternMeasurementDisplayUnit,
  type MeasurementDisplayUnit,
} from "../lib/patterns/patternMeasurementDisplayUnit";
import {
  resolveSidewaysCardiganSummaryEntryPath,
  sidewaysCardiganSummaryCancelHref,
  sidewaysCardiganSummaryCancelLabel,
  sidewaysCardiganSummaryHint,
  sidewaysCardiganSummaryPrimarySuccessHref,
} from "../lib/patterns/sidewaysCardiganPatternNavigation";
import { inspectSidewaysCardiganBodyCalcInputFromPattern } from "../lib/patterns/sidewaysCardiganFinishedMeasurements";
import { mergeSidewaysCardiganWorkingDraft } from "../lib/patterns/sidewaysCardiganWorkspaceLoad";

function setVisible(el: Element | null, visible: boolean): void {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function showEmptyState(message: string): void {
  const empty = document.querySelector("[data-sideways-summary-empty]");
  const workspace = document.querySelector("[data-sideways-summary-workspace]");
  const msg = document.querySelector("[data-sideways-summary-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(workspace, false);
}

function showWorkspace(): void {
  setVisible(document.querySelector("[data-sideways-summary-empty]"), false);
  setVisible(document.querySelector("[data-sideways-summary-workspace]"), true);
}

function unitSuffix(unit: MeasurementDisplayUnit): string {
  return unit === "cm" ? "cm" : '"';
}

function readChipMeasurements(): SidewaysCardiganSummaryMeasurements {
  const edits = emptySidewaysCardiganSummaryMeasurements();
  for (const field of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS) {
    const id = field.id as SidewaysCardiganSummaryMeasurementKey;
    if (!field.inputDataAttr) continue;
    const input = document.querySelector(`[${field.inputDataAttr}]`);
    if (!(input instanceof HTMLInputElement)) continue;
    edits[id] = input.value.trim();
  }
  return edits;
}

function writeChipMeasurements(values: SidewaysCardiganSummaryMeasurements): void {
  for (const field of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS) {
    const id = field.id as SidewaysCardiganSummaryMeasurementKey;
    if (!field.inputDataAttr) continue;
    const input = document.querySelector(`[${field.inputDataAttr}]`);
    if (!(input instanceof HTMLInputElement)) continue;
    input.value = values[id] ?? "";
  }
}

function fillChoices(): void {
  const state = readSidewaysCardiganBuilderStateFromDraft();
  const choices = document.querySelector("[data-sideways-edit-choices]");
  if (!(choices instanceof HTMLElement)) return;
  const chartLabel = sidewaysCardiganChartAudienceDisplayLabel(state.chartAudience);
  const sleeveLength = state.sleeveLengthChoice
    ? SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS[state.sleeveLengthChoice]
    : "";
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
    ["Sleeve length", sleeveLength],
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

export function initSidewaysCardiganSummaryPage(): void {
  const root = document.querySelector<HTMLElement>("[data-sideways-summary-page]");
  if (!root || root.dataset.sidewaysSummaryBound === "true") return;
  root.dataset.sidewaysSummaryBound = "true";

  void (async () => {
    const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
    if (hydrateOutcome === "load-failed") {
      applySavedPatternUnavailableMessage();
      showEmptyState(SAVED_PATTERN_UNAVAILABLE_BODY);
      return;
    }
    initWorkspace(root);
  })();
}

function initWorkspace(root: HTMLElement): void {
  stampSidewaysCardiganWorkingDraftFromPage();
  const state = readSidewaysCardiganBuilderStateFromDraft();
  const stored = readSidewaysCardiganSummaryMeasurements();
  if (!stored.finishedLength || !stored.finishedBust) {
    showEmptyState("Complete the Sideways V-Neck Sweater builder to review your measurements.");
    return;
  }

  showWorkspace();
  const workspace = root.querySelector<HTMLElement>("[data-sideways-summary-workspace]");
  if (!workspace) return;

  const entryPath = resolveSidewaysCardiganSummaryEntryPath(window.location.search);
  workspace.dataset.sidewaysSummaryEntry = entryPath;
  const hint = workspace.querySelector<HTMLElement>("[data-sideways-summary-hint]");
  if (hint) hint.textContent = sidewaysCardiganSummaryHint(entryPath);
  const cancelBtns = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-sideways-edit-cancel]"),
  );
  const cancelLabel = sidewaysCardiganSummaryCancelLabel(entryPath);
  for (const btn of cancelBtns) btn.textContent = cancelLabel;

  const diagramHost = workspace.querySelector<HTMLElement>("[data-sideways-edit-diagram]");
  const stageInner = workspace.querySelector<HTMLElement>("[data-sideways-edit-stage]");
  const overlay = workspace.querySelector<HTMLElement>("[data-sideways-edit-overlay]");
  const updateBtn = workspace.querySelector<HTMLButtonElement>("[data-sideways-edit-update]");
  const unitButtons = Array.from(
    workspace.querySelectorAll<HTMLButtonElement>("[data-sideways-edit-unit]"),
  );
  const unitSuffixEls = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-sideways-edit-unit-suffix]"),
  );

  let displayUnit: MeasurementDisplayUnit = resolveSavedPatternMeasurementDisplayUnit();
  const storedInches = { ...stored };
  let overlayCleanup: (() => void) | null = null;

  function syncUnitChrome(): void {
    for (const btn of unitButtons) {
      const u = btn.dataset.sidewaysEditUnit === "cm" ? "cm" : "in";
      const on = u === displayUnit;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const suffix = unitSuffix(displayUnit);
    for (const el of unitSuffixEls) el.textContent = suffix;
  }

  function teardownOverlay(): void {
    overlayCleanup?.();
    overlayCleanup = null;
  }

  function rebindMeasurementOverlay(): void {
    if (!diagramHost || !stageInner || !overlay) return;
    teardownOverlay();
    const svg = diagramHost.querySelector("svg");
    if (!(svg instanceof SVGElement)) return;
    applyMeasurementBlueprintViewBoxAspect(svg, stageInner);
    const anchors = collectOverlayAnchors(overlay);
    overlayCleanup = bindPatternSummaryOverlayPositioning(stageInner, svg, overlay, anchors);
  }

  function mountDiagram(): void {
    if (!diagramHost) return;
    const inspected = inspectSidewaysCardiganBodyCalcInputFromPattern(
      mergeSidewaysCardiganWorkingDraft(),
    );
    const live = readChipMeasurements();
    const input = buildSidewaysCardiganSummaryDiagramInput(
      live,
      state.garmentStyle,
      displayUnit,
      inspected.input?.backNeckDepthInches,
    );
    if (!input) return;
    diagramHost.innerHTML = buildSidewaysCardiganEditMeasurementDiagramSvg(input);
    rebindMeasurementOverlay();
  }

  function fillFromStored(): void {
    writeChipMeasurements(displaySidewaysCardiganSummaryMeasurements(storedInches, displayUnit));
    fillChoices();
    syncUnitChrome();
    mountDiagram();
  }

  fillFromStored();

  for (const field of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS) {
    if (!field.inputDataAttr) continue;
    const input = workspace.querySelector(`[${field.inputDataAttr}]`);
    if (!(input instanceof HTMLInputElement)) continue;
    input.addEventListener("input", () => {
      showEditError(null);
      mountDiagram();
    });
  }

  for (const btn of unitButtons) {
    btn.addEventListener("click", () => {
      const next: MeasurementDisplayUnit = btn.dataset.sidewaysEditUnit === "cm" ? "cm" : "in";
      if (next === displayUnit) return;
      const live = readChipMeasurements();
      const inches = summaryMeasurementsToInches(live, displayUnit);
      const asInches: SidewaysCardiganSummaryMeasurements = {
        ...storedInches,
      };
      for (const key of Object.keys(inches) as SidewaysCardiganSummaryMeasurementKey[]) {
        const n = inches[key];
        if (n === undefined) continue;
        asInches[key] = String(n);
      }
      displayUnit = next;
      writeChipMeasurements(displaySidewaysCardiganSummaryMeasurements(asInches, displayUnit));
      syncUnitChrome();
      mountDiagram();
    });
  }

  for (const btn of cancelBtns) {
    btn.addEventListener("click", () => {
      window.location.assign(
        sidewaysCardiganSummaryCancelHref(entryPath, readActiveCustomPatternProjectId()),
      );
    });
  }

  updateBtn?.addEventListener("click", () => {
    void (async () => {
      const live = readChipMeasurements();
      const inches = summaryMeasurementsToInches(live, displayUnit);
      const edits: Partial<SidewaysCardiganSummaryMeasurements> = {};
      for (const key of Object.keys(inches) as SidewaysCardiganSummaryMeasurementKey[]) {
        const n = inches[key];
        if (n === undefined) continue;
        edits[key] = String(n);
      }
      const beforeStyle = state.garmentStyle;
      const result = applySidewaysCardiganSummaryMeasurementEdits(edits, state);
      if (!result.ok) {
        showEditError(result.message);
        return;
      }
      if (result.garmentStyle !== beforeStyle) {
        showEditError("Cardigan/Pullover must stay unchanged.");
        return;
      }
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
      window.location.assign(sidewaysCardiganSummaryPrimarySuccessHref(activeId));
    })();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidewaysCardiganSummaryPage, { once: true });
} else {
  initSidewaysCardiganSummaryPage();
}
