/**
 * Sideways V-Neck Summary/Edit page — shared sweater workspace.
 * Quick edits, Body/Sleeve tabs, and chips reuse Drop Shoulder helpers.
 * Save Changes persists overrides and opens knitting-instruction workspace.
 */

import { readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { runSaveCustomPatternFromWorkspace } from "../lib/patterns/customPatternEditingBannerActions";
import { logGeneratedPatternOnce } from "../lib/patterns/patternGenerationActivity";
import { applySavedPatternUnavailableMessage, ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import {
  SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS,
  SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS,
  stampSidewaysCardiganWorkingDraftFromPage,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveLengthChoice,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import { readSidewaysCardiganBuilderStateFromDraft } from "../lib/patterns/sidewaysCardiganBuilderState";
import {
  getSidewaysCardiganChartRowsForAudience,
  SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS,
  sidewaysCardiganChartAudienceDisplayLabel,
} from "../lib/patterns/sidewaysCardiganSizeCharts";
import { loadExpressSweaterCharts, normalizeChartRowSize } from "../lib/patterns/sleevelessExpressSizeChartClient";
import {
  buildSidewaysCardiganEditMeasurementDiagramSvg,
  derivedSidewaysSummaryInches,
} from "../lib/patterns/sidewaysCardiganEditMeasurementDiagramSvg";
import {
  applyMeasurementBlueprintViewBoxAspect,
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
} from "../lib/patterns/patternSummaryMeasurementOverlay";
import {
  formatMeasurementDisplayFromInches,
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
import {
  applySidewaysCardiganSummaryMeasurementEdits,
  applySidewaysCardiganSummaryQuickEdits,
  buildSidewaysCardiganSummaryDiagramInput,
  displaySidewaysCardiganSummaryMeasurements,
  emptySidewaysCardiganSummaryMeasurements,
  readSidewaysCardiganSummaryMeasurements,
  SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS,
  summaryMeasurementsToInches,
  type SidewaysCardiganSummaryMeasurementKey,
  type SidewaysCardiganSummaryMeasurements,
} from "../lib/patterns/sidewaysCardiganSummaryEdit";
import { mergeSidewaysCardiganWorkingDraft } from "../lib/patterns/sidewaysCardiganWorkspaceLoad";
import { bindPatternProjectNotesField } from "../lib/patterns/patternProjectNotesField";
import {
  getPatternProjectMeta,
  refreshAutoPatternProjectTitle,
  resolvePatternProjectSaveNameFromState,
  savePatternProjectMeta,
} from "../lib/patterns/sleevelessPatternProjectMeta";
import {
  convertGaugeSwatchDisplayBetweenUnits,
  editWorkspaceGaugeUnitDescription,
} from "../lib/patterns/editWorkspaceGaugeUnitDisplay";
import {
  formatSwatchCountForGaugeInput,
  swatchCountFromPerInchForDisplay,
  type GaugeSwatchBasis,
} from "../lib/patterns/gaugeDisplayFormat";
import { rawSwatchToPerInch } from "../lib/patterns/syncExpressWizardToPatternStorage";
import { bindAvailableNeedlesFieldValidation } from "../lib/patterns/availableNeedlesFieldValidation";
import { getCurrentPattern, getPatternData, saveCurrentPattern, savePatternData } from "../lib/patterns/patternStorage";
import { renderMeasureReviewSummaryLine } from "../lib/patterns/sleevelessMeasureReviewSummaryUi";
import {
  applyDropShoulderEditPreviewChipVisibility,
  applyDropShoulderEditPreviewTabSelection,
  createDropShoulderEditPreviewTablist,
  DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB,
  focusDropShoulderUpperArmMeasurement,
  isDropShoulderEditPreviewTab,
  type DropShoulderEditPreviewTab,
} from "../lib/patterns/dropShoulderEditMeasurementPreview";

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

function swatchDisplayValue(raw: unknown, perInch: unknown, basis: GaugeSwatchBasis): string {
  const r = parseFloat(String(raw ?? "").trim());
  if (Number.isFinite(r) && r > 0) return formatSwatchCountForGaugeInput(r);
  const p = parseFloat(String(perInch ?? "").trim());
  if (Number.isFinite(p) && p > 0) return swatchCountFromPerInchForDisplay(p, basis);
  return "";
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

function writeChipMeasurements(
  values: SidewaysCardiganSummaryMeasurements,
  unit: MeasurementDisplayUnit,
): void {
  for (const field of SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS) {
    const id = field.id as SidewaysCardiganSummaryMeasurementKey;
    if (field.inputDataAttr) {
      const input = document.querySelector(`[${field.inputDataAttr}]`);
      if (input instanceof HTMLInputElement) input.value = values[id] ?? "";
      continue;
    }
    if (field.id === "armholeDepth") {
      const readonly = document.querySelector("[data-ps-measure-readonly='armholeDepth']");
      if (!(readonly instanceof HTMLElement)) continue;
      const inches = summaryMeasurementsToInches(values, unit);
      const derived = derivedSidewaysSummaryInches({
        finishedBustInches: inches.finishedBust ?? 1,
        finishedLengthInches: inches.finishedLength ?? 1,
        neckOpeningWidthInches: inches.neckOpeningWidth ?? 1,
        vNeckDepthInches: inches.vNeckDepth ?? 1,
        finishedUpperArmInches: inches.finishedUpperArm ?? 1,
        sleeveLengthInches: inches.sleeveLength ?? 1,
        wristInches: inches.wrist ?? 1,
      });
      readonly.textContent = formatMeasurementDisplayFromInches(derived.armholeDepthInches, unit);
    }
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

function radioValue(root: ParentNode, name: string): string {
  const el = root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return el?.value ?? "";
}

function setRadio(root: ParentNode, name: string, value: string): void {
  const els = root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
  let matched = false;
  els.forEach((el) => {
    const on = el.value === value;
    el.checked = on;
    if (on) matched = true;
  });
  if (!matched && els.length > 0) els[0].checked = true;
}

function fitLabel(fit: string): string {
  const raw = fit.trim();
  if (!raw) return "";
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
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

function stampSidewaysSummaryMeasureShell(): void {
  const editor = document.querySelector("[data-sideways-workspace-measure-summary]");
  const page =
    editor?.closest(".cb-measure-page, .express-measurements-confirm-page") ??
    document.querySelector(".cb-measure-page");
  if (page instanceof HTMLElement) {
    page.setAttribute("data-express-construction", "sideways-cardigan");
  }
}

function initWorkspace(root: HTMLElement): void {
  stampSidewaysCardiganWorkingDraftFromPage();
  stampSidewaysSummaryMeasureShell();
  let state = readSidewaysCardiganBuilderStateFromDraft();
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
  const previewWrap = workspace.querySelector<HTMLElement>("[data-sideways-edit-preview-wrap]");
  const summaryEl = workspace.querySelector<HTMLElement>("[data-cb-build-summary]");
  const updateBtn = workspace.querySelector<HTMLButtonElement>("[data-sideways-edit-update]");
  const unitButtons = Array.from(
    workspace.querySelectorAll<HTMLButtonElement>("[data-sideways-edit-unit]"),
  );
  const unitSuffixEls = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-sideways-edit-unit-suffix]"),
  );
  const sizeSelect = workspace.querySelector<HTMLSelectElement>("[data-sideways-edit-size]");
  const titleInput = workspace.querySelector<HTMLInputElement>("#sl-edit-title");
  if (entryPath === "from-builder") {
    void logGeneratedPatternOnce({
      patternSystem: "sideways-cardigan",
      patternId: readActiveCustomPatternProjectId() || undefined,
      patternTitle: titleInput?.value?.trim() || undefined,
      sourcePage: "/patterns/sideways-cardigan/summary/",
      mode: "express",
    });
  }
  const notesFieldApi = bindPatternProjectNotesField(workspace);
  const spiInput = workspace.querySelector<HTMLInputElement>("#sl-edit-spi");
  const rpiInput = workspace.querySelector<HTMLInputElement>("#sl-edit-rpi");
  const spiHint = workspace.querySelector<HTMLElement>("[data-sl-edit-spi-hint]");
  const rpiHint = workspace.querySelector<HTMLElement>("[data-sl-edit-rpi-hint]");
  const needlesInput = workspace.querySelector<HTMLInputElement>("#sl-edit-needles");
  bindAvailableNeedlesFieldValidation(needlesInput);

  let displayUnit: MeasurementDisplayUnit = resolveSavedPatternMeasurementDisplayUnit();
  let storedInches = { ...stored };
  let overlayCleanup: (() => void) | null = null;
  let previewTab: DropShoulderEditPreviewTab = DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB;

  const tablist = createDropShoulderEditPreviewTablist(document);
  previewWrap?.insertBefore(tablist, previewWrap.querySelector(".ps-measure") ?? null);
  applyDropShoulderEditPreviewTabSelection(tablist, previewTab);

  function syncUnitChrome(): void {
    for (const btn of unitButtons) {
      const u = btn.dataset.sidewaysEditUnit === "cm" ? "cm" : "in";
      const on = u === displayUnit;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const suffix = unitSuffix(displayUnit);
    for (const el of unitSuffixEls) el.textContent = suffix;
    const stitchDesc = editWorkspaceGaugeUnitDescription("stitch", displayUnit);
    const rowDesc = editWorkspaceGaugeUnitDescription("row", displayUnit);
    if (spiHint) spiHint.textContent = stitchDesc;
    if (rpiHint) rpiHint.textContent = rowDesc;
    if (spiInput) spiInput.setAttribute("aria-label", `Stitch gauge, ${stitchDesc}`);
    if (rpiInput) rpiInput.setAttribute("aria-label", `Row gauge, ${rowDesc}`);
  }

  function populateSizeOptions(selected: string): void {
    if (!sizeSelect) return;
    sizeSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a size";
    sizeSelect.append(placeholder);
    for (const group of SIDEWAYS_CARDIGAN_WOMEN_CHART_GROUPS) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.heading;
      for (const row of getSidewaysCardiganChartRowsForAudience(group.audience)) {
        const size = normalizeChartRowSize(row);
        if (!size) continue;
        const option = document.createElement("option");
        option.value = size;
        option.textContent = size;
        if (size === selected) option.selected = true;
        optgroup.append(option);
      }
      sizeSelect.append(optgroup);
    }
    if (selected) sizeSelect.value = selected;
  }

  function fillProjectDetails(): void {
    const meta = refreshAutoPatternProjectTitle();
    if (titleInput) titleInput.value = meta.title || resolvePatternProjectSaveNameFromState();
    notesFieldApi.setNotes(meta.notes);
  }

  function fillGauge(): void {
    const pattern = getCurrentPattern();
    const yg = (pattern.yarnGauge ?? {}) as Record<string, unknown>;
    const ygm = ((getPatternData().yarnGaugeMachine ?? {}) as Record<string, unknown>);
    if (spiInput) {
      spiInput.value = swatchDisplayValue(
        state.gaugeStitchRaw || yg.gaugeStitchRaw || ygm.gaugeStitchRaw,
        yg.stitchGauge ?? ygm.gaugeStitchesPerInch,
        displayUnit,
      );
    }
    if (rpiInput) {
      rpiInput.value = swatchDisplayValue(
        state.gaugeRowRaw || yg.gaugeRowRaw || ygm.gaugeRowRaw,
        yg.rowGauge ?? ygm.gaugeRowsPerInch,
        displayUnit,
      );
    }
    if (needlesInput) {
      needlesInput.value = String(
        state.availableNeedles ||
          (pattern.machine as Record<string, unknown> | undefined)?.availableNeedles ||
          ygm.availableNeedles ||
          "",
      );
    }
  }

  function fillQuickEdits(): void {
    if (sizeSelect) sizeSelect.value = state.selectedSize;
    setRadio(workspace, "sideways-edit-garment", state.garmentStyle);
    setRadio(workspace, "sideways-edit-fit", state.fit || "standard");
    setRadio(workspace, "sideways-edit-sleeve-length", state.sleeveLengthChoice || "long");
  }

  function renderBuildSummary(): void {
    if (!summaryEl) return;
    const chartLabel = sidewaysCardiganChartAudienceDisplayLabel(state.chartAudience);
    const sizeValue = state.selectedSize
      ? chartLabel
        ? `Size ${state.selectedSize} · ${chartLabel}`
        : `Size ${state.selectedSize}`
      : "";
    const sleeve = state.sleeveLengthChoice
      ? SIDEWAYS_CARDIGAN_SLEEVE_LENGTH_LABELS[state.sleeveLengthChoice]
      : "";
    const stitch = spiInput?.value.trim() ?? "";
    const rows = rpiInput?.value.trim() ?? "";
    const over = displayUnit === "cm" ? "10 cm" : '4"';
    const gauge = stitch && rows ? `${stitch} sts × ${rows} rows / ${over}` : "";
    renderMeasureReviewSummaryLine(summaryEl, [
      { label: "Size", value: sizeValue },
      { label: "Style", value: SIDEWAYS_CARDIGAN_GARMENT_STYLE_LABELS[state.garmentStyle] },
      { label: "Fit", value: fitLabel(state.fit) },
      { label: "Sleeve", value: sleeve },
      { label: "Gauge", value: gauge },
    ]);
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
    applyDropShoulderEditPreviewChipVisibility(overlay, previewTab);
    const anchors = collectOverlayAnchors(overlay).filter((anchor) => !anchor.box.hidden);
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
    diagramHost.innerHTML = buildSidewaysCardiganEditMeasurementDiagramSvg(input, previewTab);
    writeChipMeasurements(live, displayUnit);
    rebindMeasurementOverlay();
  }

  function refreshFromStored(): void {
    writeChipMeasurements(
      displaySidewaysCardiganSummaryMeasurements(storedInches, displayUnit),
      displayUnit,
    );
    fillQuickEdits();
    fillGauge();
    syncUnitChrome();
    renderBuildSummary();
    mountDiagram();
  }

  function applyQuickEdit(edits: Parameters<typeof applySidewaysCardiganSummaryQuickEdits>[0]): void {
    showEditError(null);
    const live = readChipMeasurements();
    const inches = summaryMeasurementsToInches(live, displayUnit);
    for (const key of Object.keys(inches) as SidewaysCardiganSummaryMeasurementKey[]) {
      const n = inches[key];
      if (n === undefined) continue;
      storedInches[key] = String(n);
    }
    state = {
      ...state,
      gaugeStitchRaw: spiInput?.value.trim() || state.gaugeStitchRaw,
      gaugeRowRaw: rpiInput?.value.trim() || state.gaugeRowRaw,
      availableNeedles: needlesInput?.value.trim() || state.availableNeedles,
      unit: displayUnit,
    };
    const result = applySidewaysCardiganSummaryQuickEdits(edits, state);
    if (!result.ok) {
      showEditError(result.message);
      return;
    }
    state = result.state;
    storedInches = readSidewaysCardiganSummaryMeasurements();
    refreshFromStored();
  }

  fillProjectDetails();
  populateSizeOptions(state.selectedSize);
  refreshFromStored();
  void loadExpressSweaterCharts()
    .then(() => {
      populateSizeOptions(state.selectedSize);
    })
    .catch(() => {
      if (sizeSelect) {
        sizeSelect.innerHTML = `<option value="">Could not load sizes — refresh and try again.</option>`;
      }
    });

  tablist.addEventListener("click", (ev: Event) => {
    const btn = ev.target instanceof Element ? ev.target.closest("[data-ds-edit-preview-tab]") : null;
    const nextTab = btn?.getAttribute("data-ds-edit-preview-tab");
    if (!isDropShoulderEditPreviewTab(nextTab) || nextTab === previewTab) return;
    previewTab = nextTab;
    applyDropShoulderEditPreviewTabSelection(tablist, previewTab);
    mountDiagram();
  });

  overlay?.addEventListener("click", (ev: Event) => {
    const help = ev.target instanceof Element ? ev.target.closest("[data-sideways-armhole-help]") : null;
    if (!help) return;
    previewTab = "sleeve";
    applyDropShoulderEditPreviewTabSelection(tablist, previewTab);
    mountDiagram();
    focusDropShoulderUpperArmMeasurement(overlay);
  });

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
      const asInches: SidewaysCardiganSummaryMeasurements = { ...storedInches };
      for (const key of Object.keys(inches) as SidewaysCardiganSummaryMeasurementKey[]) {
        const n = inches[key];
        if (n === undefined) continue;
        asInches[key] = String(n);
      }
      if (spiInput) {
        spiInput.value = convertGaugeSwatchDisplayBetweenUnits(spiInput.value, displayUnit, next);
      }
      if (rpiInput) {
        rpiInput.value = convertGaugeSwatchDisplayBetweenUnits(rpiInput.value, displayUnit, next);
      }
      displayUnit = next;
      writeChipMeasurements(displaySidewaysCardiganSummaryMeasurements(asInches, displayUnit), displayUnit);
      syncUnitChrome();
      renderBuildSummary();
      mountDiagram();
    });
  }

  sizeSelect?.addEventListener("change", () => {
    applyQuickEdit({ selectedSize: sizeSelect.value.trim() });
  });
  workspace.querySelectorAll<HTMLInputElement>('input[name="sideways-edit-garment"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      applyQuickEdit({ garmentStyle: el.value as SidewaysCardiganGarmentStyle });
    });
  });
  workspace.querySelectorAll<HTMLInputElement>('input[name="sideways-edit-fit"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      applyQuickEdit({ fit: el.value });
    });
  });
  workspace.querySelectorAll<HTMLInputElement>('input[name="sideways-edit-sleeve-length"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      applyQuickEdit({ sleeveLengthChoice: el.value as SidewaysCardiganSleeveLengthChoice });
    });
  });

  spiInput?.addEventListener("input", renderBuildSummary);
  rpiInput?.addEventListener("input", renderBuildSummary);

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
      const result = applySidewaysCardiganSummaryMeasurementEdits(edits, {
        ...state,
        garmentStyle: (radioValue(workspace, "sideways-edit-garment") || state.garmentStyle) as SidewaysCardiganGarmentStyle,
        fit: radioValue(workspace, "sideways-edit-fit") || state.fit,
        sleeveLengthChoice: (radioValue(workspace, "sideways-edit-sleeve-length") ||
          state.sleeveLengthChoice) as SidewaysCardiganSleeveLengthChoice,
        gaugeStitchRaw: spiInput?.value.trim() || state.gaugeStitchRaw,
        gaugeRowRaw: rpiInput?.value.trim() || state.gaugeRowRaw,
        availableNeedles: needlesInput?.value.trim() || state.availableNeedles,
        unit: displayUnit,
      });
      if (!result.ok) {
        showEditError(result.message);
        return;
      }
      state = result.state;
      const enteredTitle = titleInput?.value.trim() ?? "";
      const prevMeta = getPatternProjectMeta();
      savePatternProjectMeta({
        title: enteredTitle || resolvePatternProjectSaveNameFromState(),
        notes: notesFieldApi.getNotes(),
        titleCustomized: enteredTitle ? true : prevMeta.titleCustomized,
      });
      persistSummaryGauge(displayUnit, spiInput?.value.trim() ?? "", rpiInput?.value.trim() ?? "", needlesInput?.value.trim() ?? "");
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

function persistSummaryGauge(
  unit: MeasurementDisplayUnit,
  stitchRaw: string,
  rowRaw: string,
  needles: string,
): void {
  const hasBoth = Number(stitchRaw) > 0 && Number(rowRaw) > 0;
  const { gaugeStitchesPerInch, gaugeRowsPerInch } = hasBoth
    ? rawSwatchToPerInch(stitchRaw, rowRaw, unit)
    : { gaugeStitchesPerInch: "", gaugeRowsPerInch: "" };
  const prevMachine = {
    ...((getPatternData().yarnGaugeMachine ?? {}) as Record<string, unknown>),
  };
  const yarnGaugeCanonical: Record<string, unknown> = hasBoth
    ? {
        stitchGauge: gaugeStitchesPerInch,
        rowGauge: gaugeRowsPerInch,
        gaugeUnits: "per_inch",
        gaugeStitchRaw: stitchRaw,
        gaugeRowRaw: rowRaw,
        gaugeRawUnit: unit,
      }
    : {};
  saveCurrentPattern({
    ...(Object.keys(yarnGaugeCanonical).length > 0 ? { yarnGauge: yarnGaugeCanonical } : {}),
    machine: {
      ...((getCurrentPattern().machine ?? {}) as Record<string, unknown>),
      ...(needles ? { availableNeedles: needles } : {}),
    },
  });
  if (Object.keys(yarnGaugeCanonical).length > 0) savePatternData("yarnGauge", yarnGaugeCanonical);
  savePatternData("machine", {
    ...((getPatternData().machine ?? {}) as Record<string, unknown>),
    ...(needles ? { availableNeedles: needles } : {}),
  });
  savePatternData("yarnGaugeMachine", {
    ...prevMachine,
    ...(needles ? { availableNeedles: needles } : {}),
    gaugeStitchRaw: stitchRaw,
    gaugeRowRaw: rowRaw,
    gaugeRawUnit: unit,
    gaugeStitchesPerInch,
    gaugeRowsPerInch,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidewaysCardiganSummaryPage, { once: true });
} else {
  initSidewaysCardiganSummaryPage();
}
