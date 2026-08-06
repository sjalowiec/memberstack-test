/**
 * Hat builder page client — Express-style accordion + HatDraft persistence.
 * Navigates to /patterns/hat/pattern/?generated=1 (sweater-family flow).
 */

import hatSizingRows from "../data/sizing_hats.json";
import {
  clearHatDraft,
  emptyHatGaugeSlots,
  ensureHatDraftMigrated,
  readHatDraft,
  syncHatDraftFromBuilderFields,
  writeHatDraftAndLegacyMirrors,
  type HatDraft,
  type HatDraftUnit,
} from "../lib/patterns/hat/hatDraft";
import {
  HAT_BUILDER_HREF,
  HAT_DRAFT_MISSING_QUERY,
  HAT_DRAFT_MISSING_VALUE,
  HAT_NEW_SESSION_PARAM,
  HAT_PATTERN_WORKSPACE_GENERATED_HREF,
} from "../lib/patterns/hat/hatNavigation";
import { isHatDraftReadyForPattern } from "../lib/patterns/hat/hatPatternFromDraft";
import { HAT_FIT_HEIGHTS_INCHES, roundFinishedHatSizeFromHead } from "../lib/patterns/hat/hatMath";

type WizardUtils = {
  convertLength: (v: number, from: string, to: string) => number;
  createUnitStore: (key: string, fallback: string) => { get: () => string; set: (u: string) => void };
};

function wu(): WizardUtils {
  return (window as unknown as { WizardUtils: WizardUtils }).WizardUtils;
}

const FIT_VISUAL_ORDER = ["beanie", "watchcap", "slouchy", "relaxed"] as const;

function currentUnit(): HatDraftUnit {
  try {
    const stored = localStorage.getItem("hat-unit");
    if (stored === "cm") return "cm";
    if (stored === "inches") return "inches";
  } catch {
    /* ignore */
  }
  return unitStore?.get() === "cm" ? "cm" : "inches";
}

let unitStore: { get: () => string; set: (u: string) => void };
let gaugeSlots = emptyHatGaugeSlots();

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function readFieldsFromDom(): Parameters<typeof syncHatDraftFromBuilderFields>[0] {
  const sizeSel = el<HTMLSelectElement>("hat-size")?.value ?? "";
  const fit = el<HTMLSelectElement>("fit")?.value ?? "";
  return {
    unit: currentUnit(),
    sizeSel,
    customCircumference: el<HTMLInputElement>("custom-circumference")?.value ?? "",
    brimType: el<HTMLSelectElement>("brimType")?.value ?? "",
    brimLength: el<HTMLInputElement>("brimLength")?.value ?? "",
    crownShaping: el<HTMLSelectElement>("crown")?.value ?? "",
    fit,
    customHatLength: fit === "custom" ? el<HTMLInputElement>("custom-hat-length")?.value ?? "" : "",
    gaugeSlots,
    showTips: localStorage.getItem("hat-show-tips") === "true",
  };
}

function persistDraft(): HatDraft {
  const draft = syncHatDraftFromBuilderFields(readFieldsFromDom());
  writeHatDraftAndLegacyMirrors(draft);
  return draft;
}

function applyDraftToDom(draft: HatDraft): void {
  unitStore.set(draft.unit);
  gaugeSlots = {
    inches: { ...draft.gaugeSlots.inches },
    cm: { ...draft.gaugeSlots.cm },
  };

  const sizeSel = el<HTMLSelectElement>("hat-size");
  if (sizeSel && draft.sizeSel) sizeSel.value = draft.sizeSel;
  const customCirc = el<HTMLInputElement>("custom-circumference");
  if (customCirc) customCirc.value = draft.customCircumference;

  const fit = el<HTMLSelectElement>("fit");
  if (fit && draft.fit) fit.value = draft.fit;
  const customLen = el<HTMLInputElement>("custom-hat-length");
  if (customLen) customLen.value = draft.customHatLength;

  const brimType = el<HTMLSelectElement>("brimType");
  if (brimType && draft.brimType) brimType.value = draft.brimType;
  const brimLen = el<HTMLInputElement>("brimLength");
  if (brimLen) brimLen.value = draft.brimLength;

  const crown = el<HTMLSelectElement>("crown");
  if (crown && draft.crownShaping) crown.value = draft.crownShaping;

  applyGaugeToInputs();
  syncCustomSizeVisibility();
  syncCustomLengthVisibility();
  syncFitPickerUi();
  syncBrimPickerUi();
  syncCrownPickerUi();
  refreshSizeOptionLabels();
  updateStepUi();
}

function applyGaugeToInputs(): void {
  const u = currentUnit();
  const stitch = el<HTMLInputElement>("hat-stitch-gauge");
  const row = el<HTMLInputElement>("hat-row-gauge");
  if (stitch) stitch.value = gaugeSlots[u].stitch;
  if (row) row.value = gaugeSlots[u].row;
}

function syncGaugeFromInputs(): void {
  const u = currentUnit();
  const stitch = el<HTMLInputElement>("hat-stitch-gauge");
  const row = el<HTMLInputElement>("hat-row-gauge");
  gaugeSlots[u] = {
    stitch: stitch?.value ?? "",
    row: row?.value ?? "",
  };
}

function syncCustomSizeVisibility(): void {
  const wrap = el<HTMLElement>("custom-size");
  const sizeSel = el<HTMLSelectElement>("hat-size");
  if (!wrap || !sizeSel) return;
  wrap.style.display = sizeSel.value === "custom" ? "block" : "none";
}

function syncCustomLengthVisibility(): void {
  const wrap = el<HTMLElement>("custom-length-div");
  const fit = el<HTMLSelectElement>("fit");
  if (!wrap || !fit) return;
  wrap.style.display = fit.value === "custom" ? "block" : "none";
}

function setPickerSelection(
  selector: string,
  attr: string,
  value: string,
  summaryId: string,
  label: string,
): void {
  document.querySelectorAll(selector).forEach((btn) => {
    const selected = btn.getAttribute(attr) === value;
    btn.classList.toggle("is-selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const summary = el<HTMLElement>(summaryId);
  if (summary) summary.textContent = label || "Choose…";
}

function syncFitPickerUi(): void {
  const fit = el<HTMLSelectElement>("fit")?.value ?? "";
  const labels: Record<string, string> = {
    beanie: "Beanie",
    watchcap: "Classic",
    slouchy: "Slouchy",
    relaxed: "Relaxed",
    custom: "Custom length",
  };
  setPickerSelection(
    "[data-fit-value]",
    "data-fit-value",
    fit,
    "hat-length-summary-text",
    labels[fit] || "",
  );
  const wrap = document.querySelector(".hat-length-picker-wrap");
  wrap?.classList.toggle("is-complete", Boolean(fit));
}

function syncBrimPickerUi(): void {
  const brim = el<HTMLSelectElement>("brimType")?.value ?? "";
  const labels: Record<string, string> = {
    single: "Single Layer",
    folded: "Folded Hem",
  };
  setPickerSelection(
    "[data-brim-type-value]",
    "data-brim-type-value",
    brim,
    "brim-type-summary-text",
    labels[brim] || "",
  );
}

function syncCrownPickerUi(): void {
  const crown = el<HTMLSelectElement>("crown")?.value ?? "";
  const labels: Record<string, string> = {
    gathered: "Gathered",
    "wedge-4-decrease": "Wedge",
    spiral: "Spiral",
  };
  setPickerSelection(
    "[data-crown-value]",
    "data-crown-value",
    crown,
    "crown-summary-text",
    labels[crown] || "",
  );
}

function refreshSizeOptionLabels(): void {
  const select = el<HTMLSelectElement>("hat-size");
  if (!select) return;
  const unit = currentUnit();
  const { convertLength } = wu();
  Array.from(select.options).forEach((opt) => {
    if (!opt.value || opt.value === "custom") return;
    const row = (hatSizingRows as Array<{ size: string; circumference: number; label?: string; extended_label?: string }>).find(
      (r) => r.size === opt.value,
    );
    if (!row) return;
    const finished = roundFinishedHatSizeFromHead(Number(row.circumference));
    const display =
      unit === "cm" ? convertLength(finished, "inches", "cm") : finished;
    const name = (row.extended_label || row.label || row.size).replace(
      /\s*\([^)]*\bhead\b[^)]*\)\s*$/i,
      "",
    ).trim();
    const finLabel =
      Math.round(display * 2) / 2 % 1 === 0
        ? String(Math.round(display * 2) / 2)
        : (Math.round(display * 2) / 2).toFixed(1);
    opt.textContent = `${name} — ${finLabel}${unit === "cm" ? " cm" : '"'} finished`;
  });
}

function stepComplete(step: number): boolean {
  const draft = readFieldsFromDom();
  if (step === 1) {
    if (!draft.sizeSel) return false;
    if (draft.sizeSel === "custom" && !(parseFloat(draft.customCircumference) > 0)) return false;
    return true;
  }
  if (step === 2) {
    if (!draft.fit) return false;
    if (draft.fit === "custom" && !(parseFloat(draft.customHatLength) > 0)) return false;
    return true;
  }
  if (step === 3) {
    if (!draft.brimType || !(parseFloat(draft.brimLength) > 0)) return false;
    if (!draft.crownShaping) return false;
    return true;
  }
  if (step === 4) {
    const u = draft.unit;
    const slot = draft.gaugeSlots[u];
    return parseFloat(slot.stitch) > 0 && parseFloat(slot.row) > 0;
  }
  return false;
}

function highestUnlockedStep(): number {
  let unlocked = 1;
  for (let s = 1; s <= 4; s += 1) {
    if (stepComplete(s)) unlocked = Math.min(4, s + 1);
    else break;
  }
  return unlocked;
}

function updateStepUi(): void {
  const unlocked = highestUnlockedStep();
  document.querySelectorAll<HTMLElement>("[data-express-step]").forEach((section) => {
    const step = Number(section.getAttribute("data-express-step"));
    const complete = stepComplete(step);
    section.classList.toggle("express-acc--complete", complete);
    const check = section.querySelector("[data-express-check]");
    if (check) check.classList.toggle("is-visible", complete);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
    const step = Number(btn.getAttribute("data-pill-step"));
    const upcoming = step > unlocked;
    btn.classList.toggle("is-upcoming", upcoming);
    btn.setAttribute("aria-disabled", upcoming ? "true" : "false");
    const currentOpen = document.querySelector(".express-acc--open");
    const currentStep = Number(currentOpen?.getAttribute("data-express-step") || "1");
    btn.classList.toggle("is-current", step === currentStep);
    btn.setAttribute("aria-current", step === currentStep ? "page" : "false");
  });

  // Accordion summaries
  const sizeSel = el<HTMLSelectElement>("hat-size");
  const sizeSummary = document.querySelector('[data-express-summary="size"]');
  if (sizeSummary && sizeSel) {
    sizeSummary.textContent = sizeSel.value
      ? sizeSel.options[sizeSel.selectedIndex]?.text || sizeSel.value
      : "";
  }
  const fit = el<HTMLSelectElement>("fit")?.value ?? "";
  const fitSummary = document.querySelector('[data-express-summary="fit"]');
  if (fitSummary) {
    const labels: Record<string, string> = {
      beanie: "Beanie",
      watchcap: "Classic",
      slouchy: "Slouchy",
      relaxed: "Relaxed",
      custom: "Custom",
    };
    fitSummary.textContent = labels[fit] || "";
  }
  const styleSummary = document.querySelector('[data-express-summary="style"]');
  if (styleSummary) {
    const brim = el<HTMLSelectElement>("brimType")?.value;
    const crown = el<HTMLSelectElement>("crown")?.value;
    const parts = [];
    if (brim === "single") parts.push("Single Layer");
    if (brim === "folded") parts.push("Folded Hem");
    if (crown === "gathered") parts.push("Gathered");
    if (crown === "wedge-4-decrease") parts.push("Wedge");
    if (crown === "spiral") parts.push("Spiral");
    styleSummary.textContent = parts.join(" · ");
  }
  const gaugeSummary = document.querySelector('[data-express-summary="gauge"]');
  if (gaugeSummary) {
    const u = currentUnit();
    const slot = gaugeSlots[u];
    gaugeSummary.textContent =
      slot.stitch && slot.row ? `${slot.stitch} / ${slot.row}` : "";
  }

  const draft = persistDraft();
  const canGenerate = isHatDraftReadyForPattern(draft);
  const wrap = el<HTMLElement>("express-generate-wrap");
  if (wrap) wrap.hidden = !canGenerate;
}

function openStep(step: number): void {
  const unlocked = highestUnlockedStep();
  if (step > unlocked) return;
  document.querySelectorAll(".express-acc").forEach((section) => {
    const s = Number(section.getAttribute("data-express-step"));
    const open = s === step;
    section.classList.toggle("express-acc--open", open);
    const header = section.querySelector("[data-express-header]");
    header?.setAttribute("aria-expanded", open ? "true" : "false");
  });
  updateStepUi();
}

function bindPickerToggle(summaryId: string, panelId: string): void {
  const summary = el<HTMLButtonElement>(summaryId);
  const panel = el<HTMLElement>(panelId);
  if (!summary || !panel) return;
  summary.addEventListener("click", () => {
    const open = panel.hasAttribute("hidden");
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    summary.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function startOver(): void {
  if (!confirm("Clear all inputs and start over?")) return;
  clearHatDraft();
  gaugeSlots = emptyHatGaugeSlots();
  const form = document.getElementById("hat-builder-form");
  if (form instanceof HTMLFormElement) form.reset();
  document.querySelectorAll<HTMLSelectElement>("#hat-builder-form select").forEach((sel) => {
    sel.value = "";
    sel.selectedIndex = 0;
  });
  ["custom-circumference", "custom-hat-length", "brimLength", "hat-stitch-gauge", "hat-row-gauge"].forEach(
    (id) => {
      const input = el<HTMLInputElement>(id);
      if (input) input.value = "";
    },
  );
  syncCustomSizeVisibility();
  syncCustomLengthVisibility();
  syncFitPickerUi();
  syncBrimPickerUi();
  syncCrownPickerUi();
  applyGaugeToInputs();
  openStep(1);
  updateStepUi();
  history.replaceState({}, "", HAT_BUILDER_HREF);
}

function init(): void {
  const { createUnitStore } = wu();
  unitStore = createUnitStore("hat-unit", "inches");

  const params = new URLSearchParams(window.location.search);
  if (params.get(HAT_NEW_SESSION_PARAM) === "1") {
    clearHatDraft();
    history.replaceState({}, "", HAT_BUILDER_HREF);
  }

  ensureHatDraftMigrated();
  const draft = readHatDraft();

  if (params.get(HAT_DRAFT_MISSING_QUERY) === HAT_DRAFT_MISSING_VALUE) {
    const banner = el<HTMLElement>("hat-draft-missing-banner");
    if (banner) banner.hidden = false;
  }

  // Bind UI
  bindPickerToggle("hat-length-summary", "hat-length-panel");
  bindPickerToggle("brim-type-summary", "brim-type-panel");
  bindPickerToggle("crown-summary", "crown-panel");

  document.querySelectorAll<HTMLButtonElement>("[data-fit-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-fit-value") || "";
      const fit = el<HTMLSelectElement>("fit");
      if (fit) fit.value = v;
      syncCustomLengthVisibility();
      syncFitPickerUi();
      el<HTMLElement>("hat-length-panel")?.setAttribute("hidden", "");
      persistDraft();
      updateStepUi();
    });
  });
  el<HTMLButtonElement>("hat-length-custom-btn")?.addEventListener("click", () => {
    const fit = el<HTMLSelectElement>("fit");
    if (fit) fit.value = "custom";
    syncCustomLengthVisibility();
    syncFitPickerUi();
    el<HTMLElement>("hat-length-panel")?.setAttribute("hidden", "");
    persistDraft();
    updateStepUi();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-brim-type-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-brim-type-value") || "";
      const sel = el<HTMLSelectElement>("brimType");
      if (sel) sel.value = v;
      syncBrimPickerUi();
      el<HTMLElement>("brim-type-panel")?.setAttribute("hidden", "");
      persistDraft();
      updateStepUi();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-crown-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-crown-value") || "";
      const sel = el<HTMLSelectElement>("crown");
      if (sel) sel.value = v;
      syncCrownPickerUi();
      el<HTMLElement>("crown-panel")?.setAttribute("hidden", "");
      persistDraft();
      updateStepUi();
    });
  });

  el<HTMLSelectElement>("hat-size")?.addEventListener("change", () => {
    syncCustomSizeVisibility();
    persistDraft();
    updateStepUi();
  });
  ["custom-circumference", "custom-hat-length", "brimLength"].forEach((id) => {
    el<HTMLInputElement>(id)?.addEventListener("input", () => {
      persistDraft();
      updateStepUi();
    });
  });
  ["hat-stitch-gauge", "hat-row-gauge"].forEach((id) => {
    el<HTMLInputElement>(id)?.addEventListener("input", () => {
      syncGaugeFromInputs();
      persistDraft();
      updateStepUi();
    });
  });

  document.querySelectorAll("[data-express-header]").forEach((header) => {
    header.addEventListener("click", () => {
      const section = header.closest("[data-express-step]");
      const step = Number(section?.getAttribute("data-express-step"));
      if (step) openStep(step);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-pill-step"));
      openStep(step);
    });
  });

  el<HTMLButtonElement>("express-start-over-btn")?.addEventListener("click", startOver);
  el<HTMLButtonElement>("express-generate")?.addEventListener("click", () => {
    syncGaugeFromInputs();
    const draftNow = persistDraft();
    if (!isHatDraftReadyForPattern(draftNow)) {
      updateStepUi();
      return;
    }
    window.location.href = HAT_PATTERN_WORKSPACE_GENERATED_HREF;
  });

  window.addEventListener("kbm:units-change", ((e: Event) => {
    const detail = (e as CustomEvent<{ unit?: string; toggleId?: string }>).detail;
    if (detail?.toggleId && detail.toggleId !== "hat") return;
    const next: HatDraftUnit = detail?.unit === "cm" ? "cm" : "inches";
    unitStore.set(next);
    applyGaugeToInputs();
    refreshSizeOptionLabels();
    persistDraft();
    updateStepUi();
  }) as EventListener);

  // Crown help modal
  const helpOverlay = el<HTMLElement>("crown-help-overlay");
  el<HTMLButtonElement>("crown-help-open")?.addEventListener("click", () => {
    helpOverlay?.removeAttribute("hidden");
  });
  el<HTMLButtonElement>("crown-help-close")?.addEventListener("click", () => {
    helpOverlay?.setAttribute("hidden", "");
  });

  if (draft) {
    applyDraftToDom(draft);
    const unlocked = highestUnlockedStep();
    openStep(Math.min(unlocked, 4));
  } else {
    refreshSizeOptionLabels();
    openStep(1);
    updateStepUi();
  }

  // Ensure Fit visual includes relaxed (sanity log if missing)
  FIT_VISUAL_ORDER.forEach((v) => {
    if (!document.querySelector(`[data-fit-value="${v}"]`)) {
      console.warn("[hat-builder] missing length picker tile:", v);
    }
  });
  void HAT_FIT_HEIGHTS_INCHES;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
