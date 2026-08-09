/**
 * Hat Summary/Edit page — full-page workspace (sweater layout equivalent).
 * Loads kbm_hat_draft, validates via hatPatternEdit, writes draft, returns to finished pattern.
 * No drawer / overlay / focus trap.
 */

import {
  convertLength,
  formatLengthWithUnit,
} from "../components/wizards/utils/unitHelpers";
import { maybeFillHatGaugeSlotFromOtherUnit } from "../lib/patterns/hat/hatBuilderGaugeUnits";
import {
  buildFitPresetOptionLabel,
  buildHatSizeOptionLabel,
  buildHatSizingBuilderRows,
  HAT_FIT_PRESET_LABEL_NAMES,
} from "../lib/patterns/hat/hatBuilderSizingLabels";
import {
  createEmptyHatDraft,
  ensureHatDraftMigrated,
  readHatDraft,
  writeHatDraft,
  type HatDraft,
  type HatDraftUnit,
  type HatGaugeSlot,
} from "../lib/patterns/hat/hatDraft";
import {
  HAT_NAMED_FIT_STYLES,
  nextBrimLengthAfterBrimTypeChange,
  resolveNamedFitLengthInches,
  type HatPatternCalc,
} from "../lib/patterns/hat/hatMath";
import {
  buildHatPatternDiagramSvg,
  HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
} from "../lib/patterns/hat/hatPatternDiagramSvg";
import {
  applyHatEditFormToDraft,
  buildHatSummaryEditPreview,
  chartSizeCircumferenceDisplay,
  convertHatEditLengthDisplay,
  hatDraftToEditFormValues,
  fitPresetLengthDisplay,
  validateHatEditForm,
  type HatEditFieldErrors,
  type HatEditFormValues,
  type HatEditSizingRow,
} from "../lib/patterns/hat/hatPatternEdit";
import {
  buildHatPatternCalcFromDraft,
  HAT_PATTERN_MISSING_DRAFT_MESSAGE,
  type HatSizingPatternRow,
} from "../lib/patterns/hat/hatPatternFromDraft";
import {
  hatSummaryCancelHref,
  hatSummaryCancelLabel,
  hatSummaryHint,
  hatSummaryPrimaryLabel,
  hatSummaryPrimarySuccessHref,
  resolveHatSummaryEntryPath,
  type HatSummaryEntryPath,
  HAT_PATTERN_BUILDER_HREF,
  HAT_PATTERN_HREF,
} from "../lib/patterns/hat/hatPatternNavigation";
import {
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
} from "../lib/patterns/patternSummaryMeasurementOverlay";
import hatSizingRows from "../data/sizing_hats.json";

type LocalGaugeSlots = {
  inches: HatGaugeSlot;
  cm: HatGaugeSlot;
};

function sizingRows(): HatEditSizingRow[] {
  return buildHatSizingBuilderRows(
    Array.isArray(hatSizingRows) ? hatSizingRows : [],
  ) as HatEditSizingRow[];
}

function unitSuffix(unit: HatDraftUnit): string {
  return unit === "cm" ? "cm" : '"';
}

function gaugeHelper(unit: HatDraftUnit): string {
  return unit === "cm" ? "stitches / rows over 10 cm" : "stitches / rows over 4 inches";
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function setVisible(el: Element | null, visible: boolean) {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function showEmptyState(message: string) {
  const empty = document.querySelector("[data-hat-summary-empty]");
  const workspace = document.querySelector("[data-hat-summary-workspace]");
  const msg = document.querySelector("[data-hat-summary-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(workspace, false);
}

function showWorkspace() {
  const empty = document.querySelector("[data-hat-summary-empty]");
  const workspace = document.querySelector("[data-hat-summary-workspace]");
  setVisible(empty, false);
  setVisible(workspace, true);
}

function applyEntryPathChrome(
  workspace: HTMLElement,
  path: HatSummaryEntryPath,
  cancelBtns: HTMLElement[],
  updateBtn: HTMLButtonElement | null,
): void {
  workspace.dataset.hatSummaryEntry = path;
  const hint = workspace.querySelector<HTMLElement>("[data-hat-summary-hint]");
  if (hint) hint.textContent = hatSummaryHint(path);
  const primaryLabel = hatSummaryPrimaryLabel(path);
  const cancelLabel = hatSummaryCancelLabel(path);
  if (updateBtn) updateBtn.textContent = primaryLabel;
  for (const btn of cancelBtns) btn.textContent = cancelLabel;
}

export function initHatPatternSummaryPage(): void {
  const root = document.querySelector<HTMLElement>("[data-hat-summary-page]");
  if (!root || root.dataset.hatSummaryBound === "true") return;
  root.dataset.hatSummaryBound = "true";

  const entryPath = resolveHatSummaryEntryPath(window.location.search);

  ensureHatDraftMigrated();
  const rows = sizingRows();
  const draftCheck = buildHatPatternCalcFromDraft(readHatDraft(), rows as HatSizingPatternRow[]);
  if (!draftCheck.ok) {
    showEmptyState(draftCheck.message || HAT_PATTERN_MISSING_DRAFT_MESSAGE);
    return;
  }
  showWorkspace();

  const workspace = root.querySelector<HTMLElement>("[data-hat-summary-workspace]");
  if (!workspace) return;

  const diagramHost = workspace.querySelector<HTMLElement>("[data-hat-edit-diagram]");
  const stageInner = workspace.querySelector<HTMLElement>("[data-hat-edit-stage]");
  const overlay = workspace.querySelector<HTMLElement>("[data-hat-edit-overlay]");
  const formError = workspace.querySelector<HTMLElement>("[data-hat-edit-form-error]");
  const updateBtn = workspace.querySelector<HTMLButtonElement>("[data-hat-edit-update]");
  const cancelBtns = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-hat-edit-cancel]"),
  );
  applyEntryPathChrome(workspace, entryPath, cancelBtns, updateBtn);

  const sizeSelect = workspace.querySelector<HTMLSelectElement>("[data-hat-edit-size]");
  const fitSelect = workspace.querySelector<HTMLSelectElement>("[data-hat-edit-fit]");
  const circInput = workspace.querySelector<HTMLInputElement>("[data-hat-edit-circ]");
  const lengthInput = workspace.querySelector<HTMLInputElement>("[data-hat-edit-length]");
  const brimInput = workspace.querySelector<HTMLInputElement>("[data-hat-edit-brim]");
  const brimTypeSelect = workspace.querySelector<HTMLSelectElement>("[data-hat-edit-brim-type]");
  const crownSelect = workspace.querySelector<HTMLSelectElement>("[data-hat-edit-crown]");
  const stitchInput = workspace.querySelector<HTMLInputElement>("[data-hat-edit-stitch-gauge]");
  const rowInput = workspace.querySelector<HTMLInputElement>("[data-hat-edit-row-gauge]");
  const availableNeedlesInput = workspace.querySelector<HTMLInputElement>(
    "[data-hat-edit-available-needles]",
  );
  const unitButtons = Array.from(
    workspace.querySelectorAll<HTMLButtonElement>("[data-hat-edit-unit]"),
  );
  const unitSuffixEls = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-hat-edit-unit-suffix]"),
  );
  const gaugeHelp = workspace.querySelector<HTMLElement>("[data-hat-edit-gauge-help]");

  let activeUnit: HatDraftUnit = "inches";
  let gaugeSlots: LocalGaugeSlots = {
    inches: { stitch: "", row: "" },
    cm: { stitch: "", row: "" },
  };
  let overlayCleanup: (() => void) | null = null;
  let baselineDraft: HatDraft = structuredCloneSafe(draftCheck.draft);

  function navigateAfterCancel() {
    // Discard: never write. Draft remains as last saved (builder write or prior update).
    void baselineDraft;
    window.location.assign(hatSummaryCancelHref(entryPath));
  }

  function navigateAfterPrimarySuccess() {
    window.location.assign(hatSummaryPrimarySuccessHref(entryPath));
  }

  function setPrimaryEnabled(enabled: boolean) {
    if (updateBtn) updateBtn.disabled = !enabled;
  }

  function populateSizeOptions(unit: HatDraftUnit, selected: string) {
    if (!sizeSelect) return;
    const opts: string[] = [
      `<option value="">Choose a finished hat size…</option>`,
    ];
    for (const row of rows) {
      const inches = Number(row.finishedSizeInches);
      if (!(inches > 0)) continue;
      const label = buildHatSizeOptionLabel(row, inches, unit);
      const sel = row.size === selected ? " selected" : "";
      opts.push(
        `<option value="${escapeAttr(row.size)}" data-finished-size-inches="${inches}"${sel}>${escapeHtml(label)}</option>`,
      );
    }
    const customSel = selected === "custom" ? " selected" : "";
    opts.push(
      `<option value="custom"${customSel}>✏️ Enter your own finished hat size</option>`,
    );
    sizeSelect.innerHTML = opts.join("");
  }

  function populateFitOptions(unit: HatDraftUnit, selected: string, sizeSel: string) {
    if (!fitSelect) return;
    const opts: string[] = [`<option value="">Choose finished hat length…</option>`];
    for (const key of HAT_NAMED_FIT_STYLES) {
      const inches = resolveNamedFitLengthInches(key, sizeSel, rows);
      if (!(inches != null && inches > 0)) continue;
      const label = buildFitPresetOptionLabel(key, inches, unit);
      const sel = key === selected ? " selected" : "";
      opts.push(`<option value="${escapeAttr(key)}"${sel}>${escapeHtml(label)}</option>`);
      void HAT_FIT_PRESET_LABEL_NAMES;
    }
    const customSel = selected === "custom" ? " selected" : "";
    opts.push(
      `<option value="custom"${customSel}>✏️ Enter your own finished hat length</option>`,
    );
    fitSelect.innerHTML = opts.join("");
  }

  function readForm(): HatEditFormValues {
    return {
      unit: activeUnit,
      sizeSel: sizeSelect?.value ?? "",
      finishedCircumference: circInput?.value ?? "",
      fit: fitSelect?.value ?? "",
      finishedHatLength: lengthInput?.value ?? "",
      brimType: brimTypeSelect?.value ?? "",
      brimLength: brimInput?.value ?? "",
      crownShaping: crownSelect?.value ?? "",
      stitchGauge: stitchInput?.value ?? "",
      rowGauge: rowInput?.value ?? "",
      availableNeedles: availableNeedlesInput?.value ?? "",
    };
  }

  function syncUnitChrome() {
    for (const btn of unitButtons) {
      const u = btn.dataset.hatEditUnit === "cm" ? "cm" : "inches";
      const on = u === activeUnit;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const suffix = unitSuffix(activeUnit);
    for (const el of unitSuffixEls) el.textContent = suffix;
    if (gaugeHelp) gaugeHelp.textContent = gaugeHelper(activeUnit);
  }

  function writeForm(values: HatEditFormValues) {
    activeUnit = values.unit === "cm" ? "cm" : "inches";
    populateSizeOptions(activeUnit, values.sizeSel);
    populateFitOptions(activeUnit, values.fit, values.sizeSel);
    if (circInput) circInput.value = values.finishedCircumference;
    if (lengthInput) lengthInput.value = values.finishedHatLength;
    if (brimInput) brimInput.value = values.brimLength;
    if (brimTypeSelect) {
      brimTypeSelect.value = values.brimType;
      brimTypeSelect.dataset.hatPrevBrimType = values.brimType;
    }
    if (crownSelect) crownSelect.value = values.crownShaping;
    if (stitchInput) stitchInput.value = values.stitchGauge;
    if (rowInput) rowInput.value = values.rowGauge;
    if (availableNeedlesInput) availableNeedlesInput.value = values.availableNeedles;
    syncUnitChrome();
  }

  function clearFieldErrors() {
    workspace.querySelectorAll<HTMLElement>("[data-hat-edit-error]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    if (formError) {
      formError.hidden = true;
      formError.textContent = "";
    }
    workspace.querySelectorAll(".hat-edit-mbp-box--invalid").forEach((el) => {
      el.classList.remove("hat-edit-mbp-box--invalid");
    });
  }

  function showFieldErrors(errors: HatEditFieldErrors) {
    clearFieldErrors();
    for (const [key, message] of Object.entries(errors)) {
      if (!message) continue;
      if (key === "form") {
        if (formError) {
          formError.hidden = false;
          formError.textContent = message;
        }
        continue;
      }
      const el = workspace.querySelector<HTMLElement>(`[data-hat-edit-error="${key}"]`);
      if (el) {
        el.hidden = false;
        el.textContent = message;
      }
      const box = el?.closest(".hat-edit-mbp-box");
      if (box) box.classList.add("hat-edit-mbp-box--invalid");
    }
  }

  function teardownOverlay() {
    overlayCleanup?.();
    overlayCleanup = null;
  }

  function rebindMeasurementOverlay() {
    if (!diagramHost || !stageInner || !overlay) return;
    teardownOverlay();
    const svg = diagramHost.querySelector("svg");
    if (!(svg instanceof SVGElement)) return;
    const anchors = collectOverlayAnchors(overlay);
    overlayCleanup = bindPatternSummaryOverlayPositioning(stageInner, svg, overlay, anchors);
  }

  function mountDiagramFromCalc(calc: HatPatternCalc, unit: HatDraftUnit) {
    if (!diagramHost || !stageInner || !overlay) return;
    diagramHost.innerHTML = buildHatPatternDiagramSvg(
      calc,
      unit,
      {
        convertLength,
        formatLengthWithUnit,
      },
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    rebindMeasurementOverlay();
  }

  function mountDiagramFromDraft(draft: HatDraft) {
    if (!diagramHost || !stageInner || !overlay) return;
    const result = buildHatPatternCalcFromDraft(draft, rows as HatSizingPatternRow[]);
    if (!result.ok) {
      teardownOverlay();
      diagramHost.innerHTML =
        '<p class="hat-edit-diagram-fallback">Diagram unavailable until measurements are complete.</p>';
      return;
    }
    mountDiagramFromCalc(result.calc, result.unit);
  }

  /**
   * Rebuild the Summary/Edit SVG from current unsaved form values.
   * Never writes kbm_hat_draft. On invalid intermediate input, keeps the last valid diagram.
   */
  function refreshLivePreview() {
    const form = readForm();
    const previous = readHatDraft() ?? baselineDraft;
    const preview = buildHatSummaryEditPreview(previous, form, rows);
    if (!preview.ok) {
      showFieldErrors(preview.errors);
      setPrimaryEnabled(false);
      // Retain last valid SVG — do not blank the diagram host.
      return;
    }
    clearFieldErrors();
    setPrimaryEnabled(true);
    mountDiagramFromCalc(preview.calc, preview.unit);
  }

  function restoreFromDraft(draft: HatDraft) {
    baselineDraft = structuredCloneSafe(draft);
    gaugeSlots = {
      inches: { ...draft.gaugeSlots.inches },
      cm: { ...draft.gaugeSlots.cm },
    };
    writeForm(hatDraftToEditFormValues(draft, rows));
    clearFieldErrors();
    setPrimaryEnabled(true);
    mountDiagramFromDraft(draft);
  }

  function switchUnit(next: HatDraftUnit) {
    if (next === activeUnit) return;
    const prev = activeUnit;
    if (stitchInput && rowInput) {
      gaugeSlots[prev] = { stitch: stitchInput.value, row: rowInput.value };
    }
    gaugeSlots = maybeFillHatGaugeSlotFromOtherUnit(gaugeSlots, prev, next);
    if (circInput) {
      circInput.value = convertHatEditLengthDisplay(circInput.value, prev, next);
    }
    if (lengthInput) {
      lengthInput.value = convertHatEditLengthDisplay(lengthInput.value, prev, next);
    }
    if (brimInput) {
      brimInput.value = convertHatEditLengthDisplay(brimInput.value, prev, next);
    }
    activeUnit = next;
    const sizeSel = sizeSelect?.value ?? "";
    const fit = fitSelect?.value ?? "";
    // Keep converted circ/length — do not reload chart/fit values (would wipe a
    // custom measurement if the dropdown still showed a chart/fit name).
    populateSizeOptions(next, sizeSel);
    populateFitOptions(next, fit, sizeSel);
    if (stitchInput) stitchInput.value = gaugeSlots[next].stitch;
    if (rowInput) rowInput.value = gaugeSlots[next].row;
    syncUnitChrome();
    refreshLivePreview();
  }

  async function updatePattern() {
    clearFieldErrors();
    const form = readForm();
    const check = validateHatEditForm(form, rows);
    if (!check.ok) {
      showFieldErrors(check.errors);
      setPrimaryEnabled(false);
      return;
    }
    const previous = readHatDraft() ?? baselineDraft ?? createEmptyHatDraft();
    const next = applyHatEditFormToDraft(previous, form, rows);
    const preview = buildHatPatternCalcFromDraft(next, rows as HatSizingPatternRow[]);
    if (!preview.ok) {
      showFieldErrors({ form: preview.message });
      setPrimaryEnabled(false);
      return;
    }
    writeHatDraft(next);
    if (updateBtn) updateBtn.disabled = true;
    try {
      navigateAfterPrimarySuccess();
    } finally {
      if (updateBtn) updateBtn.disabled = false;
    }
  }

  function cancelEdit() {
    navigateAfterCancel();
  }

  restoreFromDraft(draftCheck.draft);

  cancelBtns.forEach((el) => el.addEventListener("click", cancelEdit));
  updateBtn?.addEventListener("click", () => {
    void updatePattern();
  });

  unitButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const u = btn.dataset.hatEditUnit === "cm" ? "cm" : "inches";
      switchUnit(u);
    });
  });

  sizeSelect?.addEventListener("change", () => {
    const size = sizeSelect.value;
    if (size && size !== "custom" && circInput) {
      circInput.value = chartSizeCircumferenceDisplay(size, activeUnit, rows);
    }
    const fit = fitSelect?.value ?? "";
    // Recalculate named length options for the new size. When a named style is
    // selected, update Finished hat length; Custom keeps its physical measurement.
    populateFitOptions(activeUnit, fit, size);
    if (fit && fit !== "custom" && lengthInput) {
      lengthInput.value = fitPresetLengthDisplay(fit, activeUnit, size, rows);
    }
    refreshLivePreview();
  });

  fitSelect?.addEventListener("change", () => {
    const fit = fitSelect.value;
    const size = sizeSelect?.value ?? "";
    if (fit && fit !== "custom" && lengthInput) {
      lengthInput.value = fitPresetLengthDisplay(fit, activeUnit, size, rows);
    }
    refreshLivePreview();
  });

  brimTypeSelect?.addEventListener("change", () => {
    const next = brimTypeSelect.value;
    const previous = brimTypeSelect.dataset.hatPrevBrimType ?? "";
    const defaultLength = nextBrimLengthAfterBrimTypeChange({
      previousBrimType: previous,
      nextBrimType: next,
      unit: activeUnit,
    });
    if (defaultLength != null && brimInput) {
      brimInput.value = defaultLength;
    }
    brimTypeSelect.dataset.hatPrevBrimType = next;
    refreshLivePreview();
  });

  crownSelect?.addEventListener("change", () => {
    refreshLivePreview();
  });

  circInput?.addEventListener("input", () => {
    if (sizeSelect && sizeSelect.value && sizeSelect.value !== "custom") {
      const chart = chartSizeCircumferenceDisplay(sizeSelect.value, activeUnit, rows);
      if (circInput.value.trim() !== chart) {
        sizeSelect.value = "custom";
      }
    }
    refreshLivePreview();
  });

  lengthInput?.addEventListener("input", () => {
    if (fitSelect && fitSelect.value && fitSelect.value !== "custom") {
      const size = sizeSelect?.value ?? "";
      const preset = fitPresetLengthDisplay(fitSelect.value, activeUnit, size, rows);
      if (lengthInput.value.trim() !== preset) {
        fitSelect.value = "custom";
      }
    }
    refreshLivePreview();
  });

  brimInput?.addEventListener("input", () => {
    refreshLivePreview();
  });

  stitchInput?.addEventListener("input", () => {
    refreshLivePreview();
  });

  rowInput?.addEventListener("input", () => {
    refreshLivePreview();
  });

  availableNeedlesInput?.addEventListener("input", () => {
    refreshLivePreview();
  });
}

function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export function initHatPatternSummaryPageBoot(): void {
  const run = () => initHatPatternSummaryPage();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

initHatPatternSummaryPageBoot();

/** Exported for tests — navigation contract. */
export const HAT_SUMMARY_PAGE_PATTERN_HREF = HAT_PATTERN_HREF;
export const HAT_SUMMARY_PAGE_BUILDER_HREF = HAT_PATTERN_BUILDER_HREF;
