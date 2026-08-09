/**
 * Finished-hat Edit Pattern drawer — diagram + draft inputs → existing hat math.
 * No new route, no second calculation path.
 */

import {
  convertLength,
  formatLengthWithUnit,
} from "../components/wizards/utils/unitHelpers";
import { maybeFillHatGaugeSlotFromOtherUnit } from "../lib/patterns/hat/hatBuilderGaugeUnits";
import {
  buildFitPresetOptionLabel,
  buildHatSizeOptionLabel,
  HAT_FIT_PRESET_LABEL_NAMES,
} from "../lib/patterns/hat/hatBuilderSizingLabels";
import {
  createEmptyHatDraft,
  readHatDraft,
  writeHatDraft,
  type HatDraft,
  type HatDraftUnit,
  type HatGaugeSlot,
} from "../lib/patterns/hat/hatDraft";
import { HAT_FIT_HEIGHTS_INCHES } from "../lib/patterns/hat/hatMath";
import { buildHatPatternDiagramSvg } from "../lib/patterns/hat/hatPatternDiagramSvg";
import {
  applyHatEditFormToDraft,
  chartSizeCircumferenceDisplay,
  convertHatEditLengthDisplay,
  fitPresetLengthDisplay,
  hatDraftToEditFormValues,
  validateHatEditForm,
  type HatEditFieldErrors,
  type HatEditFormValues,
  type HatEditSizingRow,
} from "../lib/patterns/hat/hatPatternEditDrawer";
import { HAT_EDIT_MEASUREMENT_TARGETS } from "../lib/patterns/hat/hatPatternEditTargets";
import { buildHatPatternCalcFromDraft } from "../lib/patterns/hat/hatPatternFromDraft";
import {
  bindPatternSummaryOverlayPositioning,
  collectOverlayAnchors,
} from "../lib/patterns/patternSummaryMeasurementOverlay";

export type HatPatternEditDrawerOptions = {
  sizingRows: ReadonlyArray<HatEditSizingRow>;
  /** Recalculate and refresh the finished pattern page after a successful update. */
  onUpdated: () => void | Promise<void>;
};

type LocalGaugeSlots = {
  inches: HatGaugeSlot;
  cm: HatGaugeSlot;
};

function unitSuffix(unit: HatDraftUnit): string {
  return unit === "cm" ? "cm" : '"';
}

function gaugeHelper(unit: HatDraftUnit): string {
  return unit === "cm" ? "stitches / rows over 10 cm" : "stitches / rows over 4 inches";
}

export function initHatPatternEditDrawer(options: HatPatternEditDrawerOptions): void {
  const drawer = document.querySelector<HTMLElement>("[data-hat-edit-drawer]");
  const openBtn = document.querySelector<HTMLElement>("[data-hat-edit-open]");
  if (!drawer || !openBtn) return;
  if (drawer.dataset.hatEditBound === "true") return;
  drawer.dataset.hatEditBound = "true";

  const panel = drawer.querySelector<HTMLElement>("[data-hat-edit-panel]");
  const diagramHost = drawer.querySelector<HTMLElement>("[data-hat-edit-diagram]");
  const stageInner = drawer.querySelector<HTMLElement>("[data-hat-edit-stage]");
  const overlay = drawer.querySelector<HTMLElement>("[data-hat-edit-overlay]");
  const formError = drawer.querySelector<HTMLElement>("[data-hat-edit-form-error]");
  const updateBtn = drawer.querySelector<HTMLButtonElement>("[data-hat-edit-update]");
  const sizeSelect = drawer.querySelector<HTMLSelectElement>("[data-hat-edit-size]");
  const fitSelect = drawer.querySelector<HTMLSelectElement>("[data-hat-edit-fit]");
  const circInput = drawer.querySelector<HTMLInputElement>("[data-hat-edit-circ]");
  const lengthInput = drawer.querySelector<HTMLInputElement>("[data-hat-edit-length]");
  const brimInput = drawer.querySelector<HTMLInputElement>("[data-hat-edit-brim]");
  const brimTypeSelect = drawer.querySelector<HTMLSelectElement>("[data-hat-edit-brim-type]");
  const crownSelect = drawer.querySelector<HTMLSelectElement>("[data-hat-edit-crown]");
  const stitchInput = drawer.querySelector<HTMLInputElement>("[data-hat-edit-stitch-gauge]");
  const rowInput = drawer.querySelector<HTMLInputElement>("[data-hat-edit-row-gauge]");
  const unitButtons = Array.from(
    drawer.querySelectorAll<HTMLButtonElement>("[data-hat-edit-unit]"),
  );
  const unitSuffixEls = Array.from(
    drawer.querySelectorAll<HTMLElement>("[data-hat-edit-unit-suffix]"),
  );
  const gaugeHelp = drawer.querySelector<HTMLElement>("[data-hat-edit-gauge-help]");
  const closeEls = Array.from(drawer.querySelectorAll<HTMLElement>("[data-hat-edit-close]"));

  let activeUnit: HatDraftUnit = "inches";
  let gaugeSlots: LocalGaugeSlots = {
    inches: { stitch: "", row: "" },
    cm: { stitch: "", row: "" },
  };
  let overlayCleanup: (() => void) | null = null;
  let savedBaselineDraft: HatDraft | null = null;

  function populateSizeOptions(unit: HatDraftUnit, selected: string) {
    if (!sizeSelect) return;
    const opts: string[] = [
      `<option value="">Choose a finished hat size…</option>`,
    ];
    for (const row of options.sizingRows) {
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

  function populateFitOptions(unit: HatDraftUnit, selected: string) {
    if (!fitSelect) return;
    const keys = Object.keys(HAT_FIT_HEIGHTS_INCHES);
    const opts: string[] = [`<option value="">Choose finished hat length…</option>`];
    for (const key of keys) {
      const inches = HAT_FIT_HEIGHTS_INCHES[key as keyof typeof HAT_FIT_HEIGHTS_INCHES];
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
    };
  }

  function writeForm(values: HatEditFormValues) {
    activeUnit = values.unit === "cm" ? "cm" : "inches";
    populateSizeOptions(activeUnit, values.sizeSel);
    populateFitOptions(activeUnit, values.fit);
    if (circInput) circInput.value = values.finishedCircumference;
    if (lengthInput) lengthInput.value = values.finishedHatLength;
    if (brimInput) brimInput.value = values.brimLength;
    if (brimTypeSelect) brimTypeSelect.value = values.brimType;
    if (crownSelect) crownSelect.value = values.crownShaping;
    if (stitchInput) stitchInput.value = values.stitchGauge;
    if (rowInput) rowInput.value = values.rowGauge;
    syncUnitChrome();
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

  function clearFieldErrors() {
    drawer.querySelectorAll<HTMLElement>("[data-hat-edit-error]").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    if (formError) {
      formError.hidden = true;
      formError.textContent = "";
    }
    drawer.querySelectorAll(".hat-edit-mbp-box--invalid").forEach((el) => {
      el.classList.remove("hat-edit-mbp-box--invalid");
    });
  }

  function showFieldErrors(errors: HatEditFieldErrors) {
    clearFieldErrors();
    const map: Record<string, string> = {
      finishedCircumference: "finishedCircumference",
      finishedHatLength: "finishedHatLength",
      brimLength: "brimLength",
      brimType: "brimType",
      crownShaping: "crownShaping",
      stitchGauge: "stitchGauge",
      rowGauge: "rowGauge",
      form: "form",
    };
    for (const [key, message] of Object.entries(errors)) {
      if (!message) continue;
      const errKey = map[key] ?? key;
      if (errKey === "form") {
        if (formError) {
          formError.hidden = false;
          formError.textContent = message;
        }
        continue;
      }
      const el = drawer.querySelector<HTMLElement>(`[data-hat-edit-error="${errKey}"]`);
      if (el) {
        el.hidden = false;
        el.textContent = message;
      }
      const box = el?.closest(".hat-edit-mbp-box");
      if (box) box.classList.add("hat-edit-mbp-box--invalid");
    }
  }

  function lockScroll(lock: boolean) {
    document.documentElement.classList.toggle("hat-edit-drawer-open", lock);
    document.body.classList.toggle("hat-edit-drawer-open", lock);
  }

  function teardownOverlay() {
    overlayCleanup?.();
    overlayCleanup = null;
  }

  function mountDiagramFromDraft(draft: HatDraft) {
    if (!diagramHost || !stageInner || !overlay) return;
    teardownOverlay();
    const result = buildHatPatternCalcFromDraft(draft, options.sizingRows);
    if (!result.ok) {
      diagramHost.innerHTML =
        '<p class="hat-edit-diagram-fallback">Diagram unavailable until measurements are complete.</p>';
      return;
    }
    diagramHost.innerHTML = buildHatPatternDiagramSvg(result.calc, result.unit, {
      convertLength,
      formatLengthWithUnit,
    });
    const svg = diagramHost.querySelector("svg");
    if (!(svg instanceof SVGElement)) return;
    const anchors = collectOverlayAnchors(overlay);
    overlayCleanup = bindPatternSummaryOverlayPositioning(stageInner, svg, overlay, anchors);
  }

  function openDrawer() {
    const draft = readHatDraft() ?? createEmptyHatDraft();
    savedBaselineDraft = structuredCloneSafe(draft);
    gaugeSlots = {
      inches: { ...draft.gaugeSlots.inches },
      cm: { ...draft.gaugeSlots.cm },
    };
    const values = hatDraftToEditFormValues(draft, options.sizingRows);
    writeForm(values);
    clearFieldErrors();
    mountDiagramFromDraft(draft);
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    openBtn.setAttribute("aria-expanded", "true");
    lockScroll(true);
    panel?.focus();
  }

  function closeDrawer(opts: { discard?: boolean } = {}) {
    if (!drawer.classList.contains("is-open")) return;
    // Discard is default: abandoned edits never write. Reopen reads saved draft.
    void opts.discard;
    teardownOverlay();
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", "false");
    lockScroll(false);
    savedBaselineDraft = null;
    openBtn.focus();
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
    populateSizeOptions(next, sizeSel);
    populateFitOptions(next, fit);
    if (sizeSel && sizeSel !== "custom" && circInput) {
      circInput.value = chartSizeCircumferenceDisplay(sizeSel, next, options.sizingRows);
    }
    if (fit && fit !== "custom" && lengthInput) {
      lengthInput.value = fitPresetLengthDisplay(fit, next);
    }
    if (stitchInput) stitchInput.value = gaugeSlots[next].stitch;
    if (rowInput) rowInput.value = gaugeSlots[next].row;
    syncUnitChrome();
  }

  async function updatePattern() {
    clearFieldErrors();
    const form = readForm();
    const check = validateHatEditForm(form, options.sizingRows);
    if (!check.ok) {
      showFieldErrors(check.errors);
      return;
    }
    const previous = readHatDraft() ?? savedBaselineDraft ?? createEmptyHatDraft();
    const next = applyHatEditFormToDraft(previous, form, options.sizingRows);
    // Confirm calc succeeds before writing — no partial update.
    const preview = buildHatPatternCalcFromDraft(next, options.sizingRows);
    if (!preview.ok) {
      showFieldErrors({ form: preview.message });
      return;
    }
    writeHatDraft(next);
    if (updateBtn) updateBtn.disabled = true;
    try {
      await options.onUpdated();
      closeDrawer({ discard: false });
      const top = document.getElementById("hat-pattern-top");
      top?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      if (updateBtn) updateBtn.disabled = false;
    }
  }

  openBtn.addEventListener("click", () => openDrawer());
  closeEls.forEach((el) => el.addEventListener("click", () => closeDrawer({ discard: true })));
  updateBtn?.addEventListener("click", () => {
    void updatePattern();
  });

  drawer.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) {
      e.preventDefault();
      closeDrawer({ discard: true });
    }
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
      circInput.value = chartSizeCircumferenceDisplay(size, activeUnit, options.sizingRows);
    }
  });

  fitSelect?.addEventListener("change", () => {
    const fit = fitSelect.value;
    if (fit && fit !== "custom" && lengthInput) {
      lengthInput.value = fitPresetLengthDisplay(fit, activeUnit);
    }
  });

  circInput?.addEventListener("input", () => {
    if (sizeSelect && sizeSelect.value && sizeSelect.value !== "custom") {
      // Editing circ away from a chart size becomes custom on Update; reflect in UI immediately.
      const chart = chartSizeCircumferenceDisplay(
        sizeSelect.value,
        activeUnit,
        options.sizingRows,
      );
      if (circInput.value.trim() !== chart) {
        sizeSelect.value = "custom";
      }
    }
  });

  lengthInput?.addEventListener("input", () => {
    if (fitSelect && fitSelect.value && fitSelect.value !== "custom") {
      const preset = fitPresetLengthDisplay(fitSelect.value, activeUnit);
      if (lengthInput.value.trim() !== preset) {
        fitSelect.value = "custom";
      }
    }
  });
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

function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

/** Exported for tests — measurement target wiring contract. */
export const HAT_EDIT_DRAWER_TARGETS = HAT_EDIT_MEASUREMENT_TARGETS;
