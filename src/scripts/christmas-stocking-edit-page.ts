/**
 * Dedicated Socks Edit workspace (`/patterns/christmas-stocking/edit/`).
 * Loads kbm_socks_draft, lets the knitter change choices/gauge,
 * and edits finished measurements only through the shared chips.
 * Update Pattern writes the draft. Cancel returns to Pattern without writing.
 * Does not run Builder wizard flow or render calculation review.
 */
import {
  createSockSizingAdapter,
  buildSockSizeOptionLabel,
  type SockSizingAdapter,
} from "../lib/patterns/christmasStocking/sockSizing";
import {
  readSockDraft,
  writeSockDraft,
  type SockDraft,
  type SockDraftUnit,
} from "../lib/patterns/christmasStocking/sockDraft";
import { maybeFillSockGaugeSlotFromOtherUnit } from "../lib/patterns/sock/sockBuilderUnits";
import { measurementsFromSockSize } from "../lib/patterns/christmasStocking/sockBuilderValidation";
import {
  convertSockSummaryMeasurements,
  sockSummaryUnitSuffix,
  type SockSummaryMeasureFields,
} from "../lib/patterns/christmasStocking/sockSummaryEdit";
import {
  applySockEditFormToDraft,
  sockDraftToEditFormValues,
  sockEditFormMeasureFields,
  validateSockEditForm,
  withSockEditFormMeasures,
  type SockEditFieldErrors,
  type SockEditFormValues,
} from "../lib/patterns/christmasStocking/sockPatternEdit";
import { SOCK_PATTERN_MISSING_DRAFT_MESSAGE } from "../lib/patterns/christmasStocking/sockPatternFromDraft";
import { SOCK_PATTERN_HREF } from "../lib/patterns/christmasStocking/sockPatternNavigation";
import { persistSockPatternProject } from "../lib/patterns/christmasStocking/sockPatternProjectSave";
import {
  applySockPatternProjectDetailsToDraft,
  buildDefaultSockPatternTitle,
  resolveSockPatternDisplayName,
  resolveSockPatternProjectNotes,
} from "../lib/patterns/christmasStocking/sockSavedProject";
import { bindPatternProjectNotesField } from "../lib/patterns/patternProjectNotesField";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";
import { applySavedPatternUnavailableMessage, ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import { withSavedPatternProjectId } from "../lib/patterns/savedPatternViewUrl";
import { PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS } from "../lib/patterns/patternSummaryMeasurementField";
import {
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
  type PatternSummaryOverlayCleanup,
} from "../lib/patterns/patternSummaryMeasurementOverlay";

function loadSizingAdapterFromPage(): SockSizingAdapter {
  const node = document.getElementById("christmas-stocking-sizing-chart");
  if (!node?.textContent?.trim()) return createSockSizingAdapter([]);
  try {
    return createSockSizingAdapter(JSON.parse(node.textContent) as unknown);
  } catch {
    return createSockSizingAdapter([]);
  }
}

function setVisible(el: Element | null, visible: boolean): void {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function showEmptyState(message: string): void {
  const empty = document.querySelector("[data-christmas-stocking-edit-empty]");
  const workspace = document.querySelector("[data-christmas-stocking-edit-workspace]");
  const msg = document.querySelector("[data-christmas-stocking-edit-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(workspace, false);
}

function showWorkspace(): void {
  const empty = document.querySelector("[data-christmas-stocking-edit-empty]");
  const workspace = document.querySelector("[data-christmas-stocking-edit-workspace]");
  setVisible(empty, false);
  setVisible(workspace, true);
}

function gaugeHelper(unit: SockDraftUnit): string {
  return unit === "cm" ? "stitches / rows over 10 cm" : "stitches / rows over 4 inches";
}

async function initSocksEditPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-christmas-stocking-edit-page]");
  if (!root || root.dataset.socksEditBound === "true") return;
  root.dataset.socksEditBound = "true";

  await reconcilePatternDraftOwner();
  const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
  if (hydrateOutcome === "load-failed") {
    applySavedPatternUnavailableMessage();
    showEmptyState(SAVED_PATTERN_UNAVAILABLE_BODY);
    return;
  }

  const adapter = loadSizingAdapterFromPage();
  const stored = readSockDraft();
  if (!stored) {
    showEmptyState(SOCK_PATTERN_MISSING_DRAFT_MESSAGE);
    return;
  }

  const workspace = root.querySelector<HTMLElement>("[data-christmas-stocking-edit-workspace]");
  if (!workspace) return;

  const diagramHost = workspace.querySelector<HTMLElement>("[data-christmas-stocking-edit-diagram]");
  const stageInner = workspace.querySelector<HTMLElement>("[data-christmas-stocking-edit-stage]");
  const overlay = workspace.querySelector<HTMLElement>("[data-christmas-stocking-edit-overlay]");
  const formError = workspace.querySelector<HTMLElement>("[data-christmas-stocking-edit-form-error]");
  const updateBtn = workspace.querySelector<HTMLButtonElement>("[data-christmas-stocking-edit-update]");
  const sizeSelect = workspace.querySelector<HTMLSelectElement>("[data-christmas-stocking-edit-size]");
  const constructionSelect = workspace.querySelector<HTMLSelectElement>(
    "[data-christmas-stocking-edit-construction]",
  );
  const chipFootCirc = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-foot-circ]");
  const chipFootLength = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-foot-length]");
  const chipLegCirc = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-leg-circ]");
  const chipLegLength = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-leg-length]");
  const stitchInput = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-stitch-gauge]");
  const rowInput = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-row-gauge]");
  const needlesInput = workspace.querySelector<HTMLInputElement>(
    "[data-christmas-stocking-edit-available-needles]",
  );
  const unitButtons = Array.from(
    workspace.querySelectorAll<HTMLButtonElement>("[data-christmas-stocking-edit-unit]"),
  );
  const unitSuffixEls = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-christmas-stocking-edit-unit-suffix]"),
  );
  const gaugeHelp = workspace.querySelector<HTMLElement>("[data-christmas-stocking-edit-gauge-help]");
  const titleInput = workspace.querySelector<HTMLInputElement>("[data-christmas-stocking-edit-title]");
  const notesFieldApi = bindPatternProjectNotesField(workspace);

  let activeUnit: SockDraftUnit = stored.unit === "cm" ? "cm" : "inches";
  let lastDraft: SockDraft = stored;
  let overlayCleanup: PatternSummaryOverlayCleanup | null = null;

  function readChipMeasures(): SockSummaryMeasureFields {
    return {
      footCircumference: chipFootCirc?.value ?? "",
      footLength: chipFootLength?.value ?? "",
      legCircumference: chipFootCirc?.value ?? "",
      legLength: chipLegLength?.value ?? "",
    };
  }

  function writeChipMeasures(measures: SockSummaryMeasureFields): void {
    if (chipFootCirc) chipFootCirc.value = measures.footCircumference;
    if (chipFootLength) chipFootLength.value = measures.footLength;
    if (chipLegCirc) chipLegCirc.value = measures.legCircumference;
    if (chipLegLength) chipLegLength.value = measures.legLength;
  }

  function readForm(): SockEditFormValues {
    const measures = readChipMeasures();
    return {
      unit: activeUnit,
      sizeSel: sizeSelect?.value ?? "",
      constructionDirection: constructionSelect?.value ?? "",
      footCircumference: measures.footCircumference,
      footLength: measures.footLength,
      legCircumference: measures.legCircumference,
      legLength: measures.legLength,
      stitchGauge: stitchInput?.value ?? "",
      rowGauge: rowInput?.value ?? "",
      availableNeedles: needlesInput?.value ?? "",
    };
  }

  function refreshSizeOptionLabels(unit: SockDraftUnit): void {
    if (!sizeSelect) return;
    Array.from(sizeSelect.options).forEach((opt) => {
      if (!opt.value) return;
      const row = adapter.measurements.find((s) => s.size === opt.value);
      if (!row) return;
      opt.textContent = buildSockSizeOptionLabel(row, unit);
    });
  }

  function syncUnitChrome(unit: SockDraftUnit): void {
    for (const btn of unitButtons) {
      const on = btn.dataset.socksEditUnit === unit;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const suffix = sockSummaryUnitSuffix(unit);
    for (const el of unitSuffixEls) el.textContent = suffix;
    if (gaugeHelp) gaugeHelp.textContent = gaugeHelper(unit);
    refreshSizeOptionLabels(unit);
  }

  function writeForm(values: SockEditFormValues): void {
    activeUnit = values.unit === "cm" ? "cm" : "inches";
    if (sizeSelect) sizeSelect.value = values.sizeSel;
    if (constructionSelect) constructionSelect.value = values.constructionDirection;
    if (stitchInput) stitchInput.value = values.stitchGauge;
    if (rowInput) rowInput.value = values.rowGauge;
    if (needlesInput) needlesInput.value = values.availableNeedles;
    writeChipMeasures(sockEditFormMeasureFields(values));
    syncUnitChrome(activeUnit);
  }

  function clearFieldErrors(): void {
    workspace.querySelectorAll<HTMLElement>("[data-christmas-stocking-edit-error]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    if (formError) {
      formError.hidden = true;
      formError.textContent = "";
    }
    workspace.querySelectorAll(`.${PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS}`).forEach((el) => {
      el.classList.remove(PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS);
    });
  }

  function showFieldErrors(errors: SockEditFieldErrors): void {
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
      workspace.querySelectorAll<HTMLElement>(`[data-christmas-stocking-edit-error="${key}"]`).forEach((el) => {
        el.hidden = false;
        el.textContent = message;
        el.closest(".ps-measure-chip")?.classList.add(PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS);
      });
    }
  }

  function teardownOverlay(): void {
    overlayCleanup?.();
    overlayCleanup = null;
  }

  function rebindMeasurementOverlay(): void {
    if (!diagramHost || !stageInner || !overlay) return;
    teardownOverlay();
    const svg = diagramHost.querySelector("svg[data-christmas-stocking-edit-chip-targets]");
    if (!(svg instanceof SVGElement)) return;
    const anchors = collectOverlayAnchors(overlay);
    overlayCleanup = bindPatternSummaryOverlayPositioning(stageInner, svg, overlay, anchors);
  }

  function switchUnit(next: SockDraftUnit): void {
    if (next === activeUnit) return;
    const form = readForm();
    lastDraft = applySockEditFormToDraft(lastDraft, form);
    const converted = convertSockSummaryMeasurements(
      sockEditFormMeasureFields(form),
      activeUnit,
      next,
    );
    const gaugeSlots = maybeFillSockGaugeSlotFromOtherUnit(
      lastDraft.gaugeSlots,
      activeUnit,
      next,
    );
    const nextForm: SockEditFormValues = {
      ...withSockEditFormMeasures(form, converted),
      unit: next,
      stitchGauge: gaugeSlots[next].stitch || form.stitchGauge,
      rowGauge: gaugeSlots[next].row || form.rowGauge,
    };
    lastDraft = applySockEditFormToDraft(lastDraft, nextForm);
    writeForm(nextForm);
  }

  function applySizeChartDefaults(): void {
    const sizeSel = sizeSelect?.value ?? "";
    const defaults = measurementsFromSockSize(sizeSel, adapter, activeUnit);
    if (!defaults) return;
    writeChipMeasures(defaults);
    lastDraft = applySockEditFormToDraft(lastDraft, readForm());
  }

  function updatePattern(): void {
    void persistAndNavigate();
  }

  async function persistAndNavigate(): Promise<void> {
    clearFieldErrors();
    const form = readForm();
    const check = validateSockEditForm(lastDraft, form, adapter);
    if (!check.ok) {
      showFieldErrors(check.errors);
      return;
    }
    const requestedName =
      titleInput?.value?.trim() ||
      resolveSockPatternDisplayName(check.draft) ||
      buildDefaultSockPatternTitle();
    const next = applySockPatternProjectDetailsToDraft(check.draft, {
      title: requestedName,
      notes: notesFieldApi.getNotes(),
    });
    writeSockDraft(next);
    lastDraft = next;
    if (updateBtn) updateBtn.disabled = true;
    try {
      const persistRes = await persistSockPatternProject({
        draft: next,
        name: requestedName,
      });
      if (!persistRes.ok) {
        showFieldErrors({ form: persistRes.error });
        return;
      }
      window.location.assign(withSavedPatternProjectId(SOCK_PATTERN_HREF, persistRes.project.id));
    } finally {
      if (updateBtn) updateBtn.disabled = false;
    }
  }

  writeForm(sockDraftToEditFormValues(stored));
  if (titleInput) {
    titleInput.value = resolveSockPatternDisplayName(stored) || buildDefaultSockPatternTitle();
  }
  notesFieldApi.setNotes(resolveSockPatternProjectNotes(stored));
  showWorkspace();
  rebindMeasurementOverlay();
  const art = diagramHost?.querySelector("img[data-christmas-stocking-edit-art]");
  if (art instanceof HTMLImageElement && !art.complete) {
    art.addEventListener("load", () => rebindMeasurementOverlay(), { once: true });
  }

  updateBtn?.addEventListener("click", () => updatePattern());

  sizeSelect?.addEventListener("change", () => applySizeChartDefaults());

  for (const input of [chipFootCirc, chipFootLength, chipLegCirc, chipLegLength]) {
    input?.addEventListener("input", () => {
      lastDraft = applySockEditFormToDraft(lastDraft, readForm());
    });
  }
  unitButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const u = btn.dataset.socksEditUnit === "cm" ? "cm" : "inches";
      switchUnit(u);
    });
  });
}

function boot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initSocksEditPage(), { once: true });
  } else {
    void initSocksEditPage();
  }
}

boot();
