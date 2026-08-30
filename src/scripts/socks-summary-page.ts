/**
 * Socks Summary/Edit page — loads kbm_socks_draft, shows calculated geometry,
 * and hosts shared measurement chips on the static single-sock Summary image.
 * View My Pattern is a link to the finished Pattern page.
 */
import {
  createSockSizingAdapter,
  type SockSizingAdapter,
} from "../lib/patterns/sock/sockSizing";
import {
  readSockDraft,
  writeSockDraft,
  type SockDraft,
  type SockDraftUnit,
} from "../lib/patterns/sock/sockDraft";
import { maybeFillSockGaugeSlotFromOtherUnit } from "../lib/patterns/sock/sockBuilderUnits";
import {
  buildSockSummaryFromDraft,
  type SockSummaryView,
} from "../lib/patterns/sock/sockPatternFromDraft";
import {
  applySockSummaryMeasurementsToDraft,
  buildSockSummaryEditPreview,
  convertSockSummaryMeasurements,
  sockSummaryMeasureFieldsFromDraft,
  sockSummaryUnitSuffix,
  type SockSummaryMeasureFields,
} from "../lib/patterns/sock/sockSummaryEdit";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";
import { PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS } from "../lib/patterns/patternSummaryMeasurementField";
import {
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
  type PatternSummaryOverlayCleanup,
} from "../lib/patterns/patternSummaryMeasurementOverlay";

function loadSizingAdapterFromPage(): SockSizingAdapter {
  const node = document.getElementById("socks-sizing-chart");
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
  const empty = document.querySelector("[data-socks-summary-empty]");
  const workspace = document.querySelector("[data-socks-summary-workspace]");
  const msg = document.querySelector("[data-socks-summary-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(workspace, false);
}

function showWorkspace(): void {
  const empty = document.querySelector("[data-socks-summary-empty]");
  const workspace = document.querySelector("[data-socks-summary-workspace]");
  setVisible(empty, false);
  setVisible(workspace, true);
}

function fill(field: keyof SockSummaryView, text: string): void {
  const el = document.querySelector(`[data-socks-summary="${field}"]`);
  if (el) el.textContent = text;
}

function fillNumber(field: keyof SockSummaryView, value: number): void {
  fill(field, String(value));
}

function renderSockSummaryView(view: SockSummaryView): void {
  fill("patternName", view.patternName);
  fill("sizeLabel", view.sizeLabel);
  fill("constructionLabel", view.constructionLabel);
  fill("unitsLabel", view.unitsLabel);
  fill("footCircumference", view.footCircumference);
  fill("footLength", view.footLength);
  fill("legCircumference", view.legCircumference);
  fill("legLength", view.legLength);
  fill("stitchGauge", view.stitchGauge);
  fill("rowGauge", view.rowGauge);
  fill("gaugeBasisLabel", view.gaugeBasisLabel);
  fill("gaugeLabel", view.gaugeLabel);
  fillNumber("totalSockStitches", view.totalSockStitches);
  fillNumber("legStitches", view.legStitches);
  fillNumber("workingStitches", view.workingStitches);
  fillNumber("heldStitches", view.heldStitches);
  fillNumber("remainingStitches", view.remainingStitches);
  fillNumber("shortRowShapingRows", view.shortRowShapingRows);
  fillNumber("returnToWorkRows", view.returnToWorkRows);
  fill("heelDepth", view.heelDepth);
  fill("toeDepth", view.toeDepth);
  fill("straightFootLength", view.straightFootLength);
  fillNumber("straightFootRows", view.straightFootRows);
  fill("ankleStraightLength", view.ankleStraightLength);
  fillNumber("ankleStraightRows", view.ankleStraightRows);
  fillNumber("legRows", view.legRows);
  fill("legShapingStatus", view.legShapingStatus);
  fillNumber("ankleStitches", view.ankleStitches);
  fillNumber("topLegStitches", view.topLegStitches);
  fill("pairedEventLabel", view.pairedEventLabel);
  fillNumber("pairedShapingEvents", view.pairedShapingEvents);
  fillNumber("legShapingRowsAvailable", view.legShapingRowsAvailable);
  fill("magicFormulaSchedule", view.magicFormulaSchedule);
  fill("knitOrderSummary", view.knitOrderSummary);
  const legDetails = document.querySelector("[data-socks-summary-leg-details]");
  if (legDetails instanceof HTMLElement) {
    legDetails.hidden = !view.legShapingNeeded;
  }
  fillNumber("requiredNeedles", view.requiredNeedles);
  fillNumber("availableNeedles", view.availableNeedles);
}

async function initSocksSummaryPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-socks-summary-page]");
  if (!root || root.dataset.socksSummaryBound === "true") return;
  root.dataset.socksSummaryBound = "true";

  await reconcilePatternDraftOwner();

  const adapter = loadSizingAdapterFromPage();
  const initial = buildSockSummaryFromDraft(readSockDraft(), adapter);
  if (!initial.ok) {
    showEmptyState(initial.message);
    return;
  }

  const workspace = root.querySelector<HTMLElement>("[data-socks-summary-workspace]");
  if (!workspace) return;

  const diagramHost = workspace.querySelector<HTMLElement>("[data-socks-summary-diagram]");
  const stageInner = workspace.querySelector<HTMLElement>("[data-socks-summary-stage]");
  const overlay = workspace.querySelector<HTMLElement>("[data-socks-summary-overlay]");
  const formError = workspace.querySelector<HTMLElement>("[data-socks-summary-form-error]");
  const footCircInput = workspace.querySelector<HTMLInputElement>("[data-socks-edit-foot-circ]");
  const footLengthInput = workspace.querySelector<HTMLInputElement>("[data-socks-edit-foot-length]");
  const legCircInput = workspace.querySelector<HTMLInputElement>("[data-socks-edit-leg-circ]");
  const legLengthInput = workspace.querySelector<HTMLInputElement>("[data-socks-edit-leg-length]");
  const unitButtons = Array.from(
    workspace.querySelectorAll<HTMLButtonElement>("[data-socks-edit-unit]"),
  );
  const unitSuffixEls = Array.from(
    workspace.querySelectorAll<HTMLElement>("[data-socks-edit-unit-suffix]"),
  );

  let overlayCleanup: PatternSummaryOverlayCleanup | null = null;
  let lastValidDraft: SockDraft = initial.draft;

  function readChipMeasures(): SockSummaryMeasureFields {
    return {
      footCircumference: footCircInput?.value ?? "",
      footLength: footLengthInput?.value ?? "",
      legCircumference: legCircInput?.value ?? "",
      legLength: legLengthInput?.value ?? "",
    };
  }

  function writeChipMeasures(measures: SockSummaryMeasureFields): void {
    if (footCircInput) footCircInput.value = measures.footCircumference;
    if (footLengthInput) footLengthInput.value = measures.footLength;
    if (legCircInput) legCircInput.value = measures.legCircumference;
    if (legLengthInput) legLengthInput.value = measures.legLength;
  }

  function syncUnitChrome(unit: SockDraftUnit): void {
    for (const btn of unitButtons) {
      const on = btn.dataset.socksEditUnit === unit;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const suffix = sockSummaryUnitSuffix(unit);
    for (const el of unitSuffixEls) el.textContent = suffix;
  }

  function clearFieldErrors(): void {
    workspace.querySelectorAll<HTMLElement>("[data-socks-edit-error]").forEach((el) => {
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

  function showMeasureError(key: string, message: string): void {
    const el = workspace.querySelector<HTMLElement>(`[data-socks-edit-error="${key}"]`);
    if (el) {
      el.hidden = false;
      el.textContent = message;
      el.closest(".ps-measure-chip")?.classList.add(PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS);
    }
    if (formError) {
      formError.hidden = false;
      formError.textContent = message;
    }
  }

  function teardownOverlay(): void {
    overlayCleanup?.();
    overlayCleanup = null;
  }

  function rebindMeasurementOverlay(): void {
    if (!diagramHost || !stageInner || !overlay) return;
    teardownOverlay();
    const svg = diagramHost.querySelector("svg[data-socks-summary-chip-targets]");
    if (!(svg instanceof SVGElement)) return;
    const anchors = collectOverlayAnchors(overlay);
    overlayCleanup = bindPatternSummaryOverlayPositioning(stageInner, svg, overlay, anchors);
  }

  function applyReady(result: Extract<typeof initial, { ok: true }>): void {
    lastValidDraft = result.draft;
    renderSockSummaryView(result.view);
    syncUnitChrome(result.view.unit);
  }

  /**
   * Rebuild from current chip values. Writes kbm_socks_draft only when calc succeeds.
   * Invalid intermediate input keeps the last valid numbers. The static sock image is not redrawn.
   */
  function refreshFromChips(writeDraft: boolean): void {
    const previous = readSockDraft() ?? lastValidDraft;
    const preview = buildSockSummaryEditPreview(
      previous,
      readChipMeasures(),
      adapter,
      previous.unit,
    );
    if (!preview.ok) {
      showMeasureError("form", preview.message);
      return;
    }
    clearFieldErrors();
    if (writeDraft) writeSockDraft(preview.draft);
    applyReady(preview);
  }

  function switchUnit(next: SockDraftUnit): void {
    const previous = readSockDraft() ?? lastValidDraft;
    if (next === previous.unit) return;
    const converted = convertSockSummaryMeasurements(
      readChipMeasures(),
      previous.unit,
      next,
    );
    const gaugeSlots = maybeFillSockGaugeSlotFromOtherUnit(previous.gaugeSlots, previous.unit, next);
    const nextDraft = applySockSummaryMeasurementsToDraft(previous, converted, next);
    nextDraft.gaugeSlots = gaugeSlots;
    const preview = buildSockSummaryFromDraft(nextDraft, adapter);
    writeChipMeasures(converted);
    syncUnitChrome(next);
    if (!preview.ok) {
      showMeasureError("form", preview.message);
      return;
    }
    writeSockDraft(preview.draft);
    applyReady(preview);
  }

  writeChipMeasures(sockSummaryMeasureFieldsFromDraft(initial.draft));
  applyReady(initial);
  showWorkspace();
  rebindMeasurementOverlay();
  const art = diagramHost?.querySelector("img[data-socks-summary-art]");
  if (art instanceof HTMLImageElement && !art.complete) {
    art.addEventListener("load", () => rebindMeasurementOverlay(), { once: true });
  }

  for (const input of [footCircInput, footLengthInput, legCircInput, legLengthInput]) {
    input?.addEventListener("input", () => refreshFromChips(true));
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
    document.addEventListener("DOMContentLoaded", () => void initSocksSummaryPage(), { once: true });
  } else {
    void initSocksSummaryPage();
  }
}

boot();
