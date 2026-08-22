/**
 * Hat Pattern Express builder client (`/patterns/hat/builder`).
 * Canonical draft: kbm_hat_draft. Opening with `?project=` hydrates that saved Hat first.
 */
import {
  createEmptyHatDraft,
  ensureHatDraftMigrated,
  readHatDraft,
  syncHatDraftFromBuilderFields,
  writeHatDraft,
  type HatDraft,
  type HatDraftUnit,
} from "../lib/patterns/hat/hatDraft";
import { applyHatNewSessionFromUrl, startOverHatBuilderSession } from "../lib/patterns/hat/hatFreshStart";
import {
  canonicalHatFitStyle,
  hatBrimDisplayLabel,
  HAT_NAMED_FIT_STYLES,
  nextBrimLengthAfterBrimTypeChange,
  resolveNamedFitLengthInches,
  resolveTotalHatLengthInches,
} from "../lib/patterns/hat/hatMath";
import {
  draftUnitFromToggleDetail,
  maybeFillHatGaugeSlotFromOtherUnit,
  type HatGaugeSlots,
} from "../lib/patterns/hat/hatBuilderGaugeUnits";
import {
  buildFitPresetOptionLabel,
  buildHatSizeOptionLabel,
  HAT_FIT_PRESET_LABEL_NAMES,
  type HatSizingLabelRow,
} from "../lib/patterns/hat/hatBuilderSizingLabels";
import {
  HAT_BUILDER_INCOMPLETE_MESSAGE,
  HAT_BUILDER_STEPS,
  evaluateHatBuilderGaugeSanityGate,
  evaluateHatBuilderNeedleCapacity,
  hatBuilderChoiceFieldAdvances,
  hatBuilderStepComplete,
  isHatBuilderReadyToCreatePattern,
  nextHatBuilderOpenStepAfterFieldChange,
  type HatBuilderFieldSnapshot,
  type HatBuilderSizeRow,
} from "../lib/patterns/hat/hatBuilderValidation";
import { hideGaugeSanityWarning, renderGaugeSanityWarning } from "../lib/patterns/gaugeSanityUi";
import { HAT_AVAILABLE_NEEDLES_INPUT_ID } from "../lib/patterns/hat/hatAvailableNeedles";
import { syncExpressNeedleBlockVisibility } from "../lib/patterns/expressBuilderReviewSubmit";
import {
  bindAvailableNeedlesFieldValidation,
  setAvailableNeedlesFieldErrorState,
} from "../lib/patterns/availableNeedlesFieldValidation";
import { focusFirstInputInSection } from "../lib/patterns/focusFirstInputInSection";
import { isValidExpressAvailableNeedles } from "../lib/patterns/sleevelessExpressAvailableNeedles";
import { buildHatSummaryEditFromBuilderHref } from "../lib/patterns/hat/hatPatternNavigation";
import { ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";

const STEPS = HAT_BUILDER_STEPS;
const LEGACY_HAT_UNIT_KEY = "hat-unit";
const HAT_SUMMARY_FROM_BUILDER_HREF = buildHatSummaryEditFromBuilderHref();

type SizingRow = HatBuilderSizeRow & HatSizingLabelRow;

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function readSelectValue(sel: HTMLSelectElement | null): string {
  return (sel?.value ?? "").trim();
}

function setSelectValue(sel: HTMLSelectElement | null, value: string): void {
  if (!sel) return;
  const v = value.trim();
  if (!v) {
    const idx = Array.from(sel.options).findIndex((opt) => String(opt.value ?? "").trim() === "");
    if (idx >= 0) sel.selectedIndex = idx;
    else sel.value = "";
    return;
  }
  const match = Array.from(sel.options).find((opt) => opt.value === v && !opt.disabled);
  sel.value = match ? v : "";
}

function syncChoiceButtons(field: string, value: string): void {
  document.querySelectorAll<HTMLButtonElement>(`[data-choice][data-field="${field}"]`).forEach((btn) => {
    const selected = (btn.getAttribute("data-value") ?? "") === value;
    btn.classList.toggle("is-selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function persistHatUnitKey(unit: HatDraftUnit): void {
  try {
    localStorage.setItem(LEGACY_HAT_UNIT_KEY, unit === "cm" ? "cm" : "inches");
  } catch {
    /* ignore */
  }
}

function loadSizingRowsFromPage(): SizingRow[] {
  const node = document.getElementById("hat-sizing-builder-rows");
  if (!node?.textContent?.trim()) return [];
  try {
    const parsed = JSON.parse(node.textContent) as unknown;
    if (!Array.isArray(parsed)) return [];
    const rows: SizingRow[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const size = typeof r.size === "string" ? r.size : "";
      const finished = Number(r.finishedSizeInches);
      if (!size || !Number.isFinite(finished) || finished <= 0) continue;
      rows.push({
        size,
        finishedSizeInches: finished,
        circumference: Number(r.circumference) || finished,
        label: typeof r.label === "string" ? r.label : size,
        extended_label: typeof r.extended_label === "string" ? r.extended_label : undefined,
        hatLength: typeof r.hatLength === "number" ? r.hatLength : undefined,
        suggestedCrownDepth:
          typeof r.suggestedCrownDepth === "number" ? r.suggestedCrownDepth : undefined,
        optionLabel: typeof r.optionLabel === "string" ? r.optionLabel : undefined,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

function syncUnitToggleUi(unit: HatDraftUnit): void {
  const wrap = document.querySelector<HTMLElement>('[data-unit-toggle="hat"]');
  if (!wrap) return;
  const isInches = unit === "inches";
  const inchesBtn = wrap.querySelector<HTMLButtonElement>('button[data-unit="in"]');
  const cmBtn = wrap.querySelector<HTMLButtonElement>('button[data-unit="cm"]');
  const hiddenInput = wrap.querySelector<HTMLInputElement>("[data-kbm-unit-value]");
  inchesBtn?.classList.toggle("active", isInches);
  cmBtn?.classList.toggle("active", !isInches);
  inchesBtn?.setAttribute("aria-pressed", isInches ? "true" : "false");
  cmBtn?.setAttribute("aria-pressed", !isInches ? "true" : "false");
  if (hiddenInput) hiddenInput.value = isInches ? "in" : "cm";
}

async function initHatBuilderPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-hat-builder]");
  if (!root) return;

  const hatSizeSelect = el<HTMLSelectElement>("hat-size");
  const customCircInput = el<HTMLInputElement>("custom-circumference");
  const fitSelect = el<HTMLSelectElement>("fit");
  const customHatLengthInput = el<HTMLInputElement>("custom-hat-length");
  const brimTypeSelect = el<HTMLSelectElement>("brimType");
  const brimLengthInput = el<HTMLInputElement>("brimLength");
  const crownSelect = el<HTMLSelectElement>("crown");
  const stitchGaugeInput = el<HTMLInputElement>("hat-stitch-gauge");
  const rowGaugeInput = el<HTMLInputElement>("hat-row-gauge");
  const availableNeedlesInput = el<HTMLInputElement>(HAT_AVAILABLE_NEEDLES_INPUT_ID);
  const needleCapacityErrorEl = el<HTMLElement>("hat-needle-capacity-error");
  const createPatternBtn = el<HTMLButtonElement>("create-pattern-btn");
  const feedbackEl = el<HTMLElement>("create-pattern-feedback");
  const customSizeWrap = document.querySelector<HTMLElement>("[data-hat-custom-size]");
  const customLengthWrap = document.querySelector<HTMLElement>("[data-hat-custom-length]");

  let sizingRows = loadSizingRowsFromPage();
  let gaugeSlots: HatGaugeSlots = {
    inches: { stitch: "", row: "" },
    cm: { stitch: "", row: "" },
  };
  let activeUnit: HatDraftUnit = "inches";
  let openStep = 1;
  let maxReachable = 1;
  let feedbackTimer = 0;
  let suppressPersist = false;
  let unitsListenerReady = false;
  let isSubmitting = false;
  let acknowledgedGaugeKey: string | null = null;

  // --- Fresh start (`?new=1`), then authoritative saved-project hydrate, then local draft ---
  applyHatNewSessionFromUrl();
  await ensureUrlRequestedSavedPatternHydrated();
  ensureHatDraftMigrated();
  let draft: HatDraft = readHatDraft() ?? createEmptyHatDraft();
  if (!readHatDraft()) {
    writeHatDraft(draft);
  }
  activeUnit = draft.unit === "cm" ? "cm" : "inches";
  persistHatUnitKey(activeUnit);
  syncUnitToggleUi(activeUnit);
  gaugeSlots = {
    inches: { ...draft.gaugeSlots.inches },
    cm: { ...draft.gaugeSlots.cm },
  };

  function snapshotFields(): HatBuilderFieldSnapshot {
    return {
      sizeSel: readSelectValue(hatSizeSelect),
      customCircumference: customCircInput?.value ?? "",
      brimType: readSelectValue(brimTypeSelect),
      brimLength: brimLengthInput?.value ?? "",
      crownShaping: readSelectValue(crownSelect),
      fit: readSelectValue(fitSelect),
      customHatLength: customHatLengthInput?.value ?? "",
      stitchGauge: stitchGaugeInput?.value ?? "",
      rowGauge: rowGaugeInput?.value ?? "",
      availableNeedles: availableNeedlesInput?.value ?? "",
    };
  }

  function syncCanonicalDraft(): void {
    if (suppressPersist) return;
    const fields = snapshotFields();
    const u = activeUnit;
    if (stitchGaugeInput && rowGaugeInput) {
      gaugeSlots[u] = {
        stitch: stitchGaugeInput.value,
        row: rowGaugeInput.value,
      };
    }
    draft = syncHatDraftFromBuilderFields({
      unit: u,
      sizeSel: fields.sizeSel,
      customCircumference: fields.customCircumference,
      brimType: fields.brimType,
      brimLength: fields.brimLength,
      crownShaping: fields.crownShaping,
      fit: fields.fit,
      customHatLength: fields.fit === "custom" ? fields.customHatLength : "",
      gaugeSlots,
      availableNeedles: fields.availableNeedles,
      showTips: draft.showTips,
    });
  }

  function syncNeedleBlockVisibility(fields: HatBuilderFieldSnapshot = snapshotFields()): void {
    const stitchRowOk =
      Number(fields.stitchGauge.trim()) > 0 && Number(fields.rowGauge.trim()) > 0;
    syncExpressNeedleBlockVisibility(document, stitchRowOk);
  }

  function syncNeedleCapacityFeedback(fields: HatBuilderFieldSnapshot = snapshotFields()): void {
    const capacity = evaluateHatBuilderNeedleCapacity(fields, sizingRows, activeUnit);
    const showCapacityError = !capacity.ok && Boolean(capacity.message);
    if (needleCapacityErrorEl) {
      needleCapacityErrorEl.textContent = showCapacityError ? capacity.message : "";
      needleCapacityErrorEl.hidden = !showCapacityError;
    }
    if (availableNeedlesInput && showCapacityError) {
      setAvailableNeedlesFieldErrorState(availableNeedlesInput, true);
    } else if (availableNeedlesInput && isValidExpressAvailableNeedles(availableNeedlesInput.value)) {
      setAvailableNeedlesFieldErrorState(availableNeedlesInput, false);
    }
  }

  function syncCustomSizeVisibility(): void {
    const isCustom = readSelectValue(hatSizeSelect) === "custom";
    if (customSizeWrap) customSizeWrap.hidden = !isCustom;
  }

  function syncCustomLengthVisibility(): void {
    const isCustom = readSelectValue(fitSelect) === "custom";
    if (customLengthWrap) customLengthWrap.hidden = !isCustom;
  }

  function syncSizeSelectCompletion(): void {
    const wrap = hatSizeSelect?.closest(".hat-select-wrap");
    if (wrap) {
      wrap.classList.toggle("is-complete", readSelectValue(hatSizeSelect) !== "");
    }
  }

  function updateFloatingLabels(unit: HatDraftUnit): void {
    const unitWord = unit === "cm" ? "cm" : "inches";
    const circLab = document.querySelector('label[for="custom-circumference"]');
    const lenLab = document.querySelector('label[for="custom-hat-length"]');
    const brimLab = document.querySelector('label[for="brimLength"]');
    if (circLab) circLab.textContent = `Custom Finished Hat Size (${unitWord})`;
    if (lenLab) {
      lenLab.textContent = `Finished Hat Length (bottom of brim to top of crown) (${unitWord})`;
    }
    if (brimLab) brimLab.textContent = `Visible Brim Height (when worn) (${unitWord})`;
    if (hatSizeSelect) {
      hatSizeSelect.setAttribute("aria-label", `Choose a finished hat size (${unitWord})`);
      const firstOpt = hatSizeSelect.options[0];
      if (firstOpt && firstOpt.value === "") {
        firstOpt.textContent = `Choose a finished hat size (${unitWord})...`;
      }
    }
  }

  function refreshHatSizeDropdownLabels(unit: HatDraftUnit): void {
    if (!hatSizeSelect) return;
    Array.from(hatSizeSelect.options).forEach((opt) => {
      const v = opt.value;
      if (!v || v === "custom") return;
      const row = sizingRows.find((s) => s.size === v);
      if (!row) return;
      opt.textContent = buildHatSizeOptionLabel(row, row.finishedSizeInches, unit);
    });
  }

  /** Refresh named length picker / select labels from the selected size’s Standard length. */
  function refreshFitLengthLabels(unit: HatDraftUnit = activeUnit): void {
    const sizeSel = readSelectValue(hatSizeSelect);
    for (const fitKey of HAT_NAMED_FIT_STYLES) {
      const inches = resolveNamedFitLengthInches(fitKey, sizeSel, sizingRows);
      if (!(inches != null && inches > 0)) continue;
      const label = buildFitPresetOptionLabel(fitKey, inches, unit);
      const name = HAT_FIT_PRESET_LABEL_NAMES[fitKey] || fitKey;
      const shortLabel =
        unit === "inches"
          ? `${name} (${inches % 1 === 0 ? String(inches) : inches.toFixed(1)}")`
          : `${name} (${(inches * 2.54).toFixed(1)} cm)`;
      if (fitSelect) {
        const opt = Array.from(fitSelect.options).find((o) => o.value === fitKey);
        if (opt) opt.textContent = label;
      }
      document
        .querySelectorAll<HTMLElement>(`[data-choice][data-field="fit"][data-value="${fitKey}"]`)
        .forEach((btn) => {
          const span = btn.querySelector(".hat-length-picker__option-label");
          if (span) span.textContent = shortLabel;
        });
    }
  }

  function applyFitChoiceUi(): void {
    const fit = readSelectValue(fitSelect);
    syncChoiceButtons("fit", fit === "custom" ? "" : fit);
    syncCustomLengthVisibility();
  }

  function applyBrimChoiceUi(): void {
    const brimType = readSelectValue(brimTypeSelect);
    syncChoiceButtons("brimType", brimType);
    const helper = document.querySelector<HTMLElement>("[data-brim-helper]");
    if (helper) {
      if (brimType === "folded") {
        helper.textContent = "We'll automatically adjust the rows for the fold.";
      } else if (brimType === "rolled") {
        helper.textContent =
          "Stockinette curls at the lower edge. Default is 1 inch — you can change it.";
      } else {
        helper.textContent = "Enter the brim height as worn.";
      }
    }
  }

  function applyRolledBrimDefaultIfNeeded(previousBrimType: string, nextBrimType: string): void {
    const nextLength = nextBrimLengthAfterBrimTypeChange({
      previousBrimType,
      nextBrimType,
      unit: activeUnit,
    });
    if (nextLength != null && brimLengthInput) {
      brimLengthInput.value = nextLength;
    }
  }

  function applyCrownChoiceUi(): void {
    syncChoiceButtons("crown", readSelectValue(crownSelect));
  }

  function applyGaugeInputsFromActiveSlot(): void {
    if (!stitchGaugeInput || !rowGaugeInput) return;
    stitchGaugeInput.value = gaugeSlots[activeUnit].stitch;
    rowGaugeInput.value = gaugeSlots[activeUnit].row;
  }

  function hydrateFromDraft(d: HatDraft): void {
    suppressPersist = true;
    activeUnit = d.unit === "cm" ? "cm" : "inches";
    persistHatUnitKey(activeUnit);
    gaugeSlots = {
      inches: { ...d.gaugeSlots.inches },
      cm: { ...d.gaugeSlots.cm },
    };

    setSelectValue(hatSizeSelect, d.sizeSel);
    if (customCircInput) customCircInput.value = d.customCircumference;
    setSelectValue(fitSelect, canonicalHatFitStyle(d.fit));
    if (customHatLengthInput) customHatLengthInput.value = d.customHatLength;
    setSelectValue(brimTypeSelect, d.brimType);
    if (brimLengthInput) brimLengthInput.value = d.brimLength;
    setSelectValue(crownSelect, d.crownShaping === "wedge-4" ? "wedge-4-decrease" : d.crownShaping);
    applyGaugeInputsFromActiveSlot();
    if (availableNeedlesInput) availableNeedlesInput.value = d.availableNeedles ?? "";

    syncCustomSizeVisibility();
    applyFitChoiceUi();
    applyBrimChoiceUi();
    applyCrownChoiceUi();
    syncSizeSelectCompletion();
    updateFloatingLabels(activeUnit);
    refreshHatSizeDropdownLabels(activeUnit);
    refreshFitLengthLabels(activeUnit);
    suppressPersist = false;
  }

  function summaryForStep(step: number, fields: HatBuilderFieldSnapshot): string {
    switch (step) {
      case 1: {
        if (!fields.sizeSel) return "";
        if (fields.sizeSel === "custom") {
          const unitWord = activeUnit === "cm" ? "cm" : '"';
          return fields.customCircumference.trim()
            ? `Custom ${fields.customCircumference.trim()}${unitWord}`
            : "Custom";
        }
        const row = sizingRows.find((s) => s.size === fields.sizeSel);
        return row ? hatSizeSelect?.selectedOptions[0]?.textContent?.split("—")[0]?.trim() || fields.sizeSel : fields.sizeSel;
      }
      case 2: {
        if (!fields.fit) return "";
        if (fields.fit === "custom") {
          return fields.customHatLength.trim()
            ? `Custom ${fields.customHatLength.trim()}`
            : "Custom";
        }
        const name = HAT_FIT_PRESET_LABEL_NAMES[fields.fit] || fields.fit;
        // Named fit preset wins over chart hatLength — same total as calc/diagram.
        const inches = resolveTotalHatLengthInches({
          fit: fields.fit,
          hatSizeValue: fields.sizeSel,
          customLengthDisplay: Number(fields.customHatLength) || 0,
          displayUnit: activeUnit,
          sizingRows,
        });
        if (inches != null && Number.isFinite(inches) && inches > 0) {
          return buildFitPresetOptionLabel(fields.fit, inches, activeUnit);
        }
        return name;
      }
      case 3: {
        if (!fields.brimType) return "";
        const label = hatBrimDisplayLabel(fields.brimType);
        const h = fields.brimLength.trim();
        return h ? `${label} · ${h}` : label;
      }
      case 4: {
        if (fields.crownShaping === "gathered") return "Gathered";
        if (fields.crownShaping === "wedge-4-decrease") return "Four-Gore";
        if (fields.crownShaping === "spiral") return "Swirl Top";
        return "";
      }
      case 5: {
        const st = fields.stitchGauge.trim();
        const rg = fields.rowGauge.trim();
        const needles = fields.availableNeedles.trim();
        if (!st || !rg) return "";
        return needles ? `${st} × ${rg} · ${needles} needles` : `${st} × ${rg}`;
      }
      default:
        return "";
    }
  }

  function stepSection(step: number): HTMLElement | null {
    return document.querySelector(`[data-express-step="${step}"]`);
  }

  function maxReachableFromChoices(fields: HatBuilderFieldSnapshot): number {
    let max = 1;
    for (let step = 1; step < STEPS; step += 1) {
      if (!hatBuilderStepComplete(step, fields, sizingRows, activeUnit)) break;
      max = step + 1;
    }
    if (hatBuilderStepComplete(STEPS, fields, sizingRows, activeUnit)) max = STEPS;
    return max;
  }

  function refreshAccordionUi(): void {
    const fields = snapshotFields();
    maxReachable = maxReachableFromChoices(fields);
    if (openStep > maxReachable) openStep = maxReachable;
    syncNeedleBlockVisibility(fields);
    syncNeedleCapacityFeedback(fields);

    for (let step = 1; step <= STEPS; step += 1) {
      const sectionEl = stepSection(step);
      if (!sectionEl) continue;
      const complete = hatBuilderStepComplete(step, fields, sizingRows, activeUnit);
      const locked = step > maxReachable;
      const open = step === openStep && !locked;
      sectionEl.classList.toggle("express-acc--open", open);
      sectionEl.classList.toggle("express-acc--locked", locked);
      sectionEl.classList.toggle("express-acc--complete", complete);

      const header = sectionEl.querySelector<HTMLElement>("[data-express-header]");
      const body = sectionEl.querySelector<HTMLElement>(".express-acc__body");
      const lockedFb = sectionEl.querySelector<HTMLElement>("[data-express-locked-feedback]");
      if (header) {
        header.setAttribute("aria-expanded", open ? "true" : "false");
        header.tabIndex = locked ? -1 : 0;
      }
      if (body && step !== STEPS) {
        // Gauge body can stay collapsible; CTA footer stays outside body in markup for step 5.
        body.hidden = !open;
      } else if (body && step === STEPS) {
        body.hidden = !open;
      }
      if (lockedFb) lockedFb.hidden = !locked;

      const summaryKey =
        step === 1
          ? "size"
          : step === 2
            ? "length"
            : step === 3
              ? "brim"
              : step === 4
                ? "crown"
                : "gauge";
      const summaryEl = sectionEl.querySelector<HTMLElement>(`[data-express-summary="${summaryKey}"]`);
      if (summaryEl) summaryEl.textContent = complete ? summaryForStep(step, fields) : "";
    }

    document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
      const step = Number(btn.getAttribute("data-pill-step") || "0");
      const reachable = step <= maxReachable;
      const current = step === openStep;
      const complete = hatBuilderStepComplete(step, fields, sizingRows, activeUnit);
      btn.classList.toggle("is-current", current);
      btn.classList.toggle("is-upcoming", step > maxReachable);
      btn.classList.toggle("is-complete", complete && !current);
      btn.setAttribute("aria-disabled", reachable ? "false" : "true");
      if (current) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
      const item = btn.closest(".express-step-nav__item");
      item?.classList.toggle("active", current);
    });

    updateCtaUi(fields);
  }

  function goToStep(step: number): void {
    if (step < 1 || step > STEPS) return;
    if (step > maxReachable) return;
    openStep = step;
    refreshAccordionUi();
    const sectionEl = stepSection(step);
    sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateCtaUi(fields: HatBuilderFieldSnapshot = snapshotFields()): void {
    const ready = isHatBuilderReadyToCreatePattern(fields, sizingRows, activeUnit);
    if (!createPatternBtn) return;
    createPatternBtn.classList.toggle("button-disabled", !ready);
    if (ready) {
      createPatternBtn.removeAttribute("aria-disabled");
    } else {
      createPatternBtn.setAttribute("aria-disabled", "true");
    }
  }

  function showFeedback(message: string): void {
    window.clearTimeout(feedbackTimer);
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.hidden = !message;
    if (!message) return;
    feedbackTimer = window.setTimeout(() => {
      feedbackEl.textContent = "";
      feedbackEl.hidden = true;
    }, 4000);
  }

  function focusFirstIncompleteStep(fields: HatBuilderFieldSnapshot): void {
    for (let step = 1; step <= STEPS; step += 1) {
      if (hatBuilderStepComplete(step, fields, sizingRows, activeUnit)) continue;
      // Allow opening the incomplete step even if accordion lock would block it.
      maxReachable = Math.max(maxReachable, step);
      goToStep(step);
      const sectionEl = stepSection(step);
      if (sectionEl) focusFirstInputInSection(sectionEl);
      return;
    }
  }

  function onFieldChanged(opts?: { advance?: boolean }): void {
    syncCanonicalDraft();
    syncCustomSizeVisibility();
    applyFitChoiceUi();
    applyBrimChoiceUi();
    applyCrownChoiceUi();
    syncSizeSelectCompletion();
    refreshFitLengthLabels();
    const fields = snapshotFields();
    const prevMax = maxReachable;
    refreshAccordionUi();
    const nextOpen = nextHatBuilderOpenStepAfterFieldChange({
      advance: Boolean(opts?.advance),
      openStep,
      maxReachableAfter: maxReachable,
      prevMaxReachable: prevMax,
      currentStepComplete: hatBuilderStepComplete(openStep, fields, sizingRows, activeUnit),
      totalSteps: STEPS,
    });
    if (nextOpen !== openStep) goToStep(nextOpen);
  }

  // --- Wire inputs ---
  hatSizeSelect?.addEventListener("change", () => onFieldChanged({ advance: true }));
  customCircInput?.addEventListener("input", () => onFieldChanged());
  customCircInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
  brimLengthInput?.addEventListener("input", () => onFieldChanged());
  brimLengthInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
  customHatLengthInput?.addEventListener("input", () => onFieldChanged());
  customHatLengthInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
  stitchGaugeInput?.addEventListener("input", () => {
    hideGaugeSanityWarning(document);
    onFieldChanged();
  });
  stitchGaugeInput?.addEventListener("change", () => onFieldChanged());
  rowGaugeInput?.addEventListener("input", () => {
    hideGaugeSanityWarning(document);
    onFieldChanged();
  });
  rowGaugeInput?.addEventListener("change", () => onFieldChanged());
  availableNeedlesInput?.addEventListener("input", () => onFieldChanged());
  availableNeedlesInput?.addEventListener("change", () => onFieldChanged());
  bindAvailableNeedlesFieldValidation(availableNeedlesInput);

  document.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.getAttribute("data-field");
      const value = btn.getAttribute("data-value") ?? "";
      if (!field || !value) return;
      if (field === "fit") setSelectValue(fitSelect, value);
      else if (field === "brimType") {
        const previous = readSelectValue(brimTypeSelect);
        setSelectValue(brimTypeSelect, value);
        applyRolledBrimDefaultIfNeeded(previous, value);
      } else if (field === "crown") setSelectValue(crownSelect, value);
      // Brim type stays open so height remains editable; other pickers may advance.
      onFieldChanged({ advance: hatBuilderChoiceFieldAdvances(field) });
    });
  });

  el<HTMLButtonElement>("hat-length-custom-btn")?.addEventListener("click", () => {
    setSelectValue(fitSelect, "custom");
    onFieldChanged();
    customHatLengthInput?.focus();
  });

  // Accordion headers + pills
  document.querySelectorAll<HTMLElement>("[data-express-header]").forEach((header) => {
    const activate = () => {
      const sec = header.closest<HTMLElement>("[data-express-step]");
      const step = Number(sec?.getAttribute("data-express-step") || "0");
      if (step >= 1 && step <= maxReachable) {
        goToStep(step === openStep ? step : step);
      }
    };
    header.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-express-chevron]")) {
        activate();
        return;
      }
      activate();
    });
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-pill-step") || "0");
      goToStep(step);
    });
  });

  window.addEventListener("kbm:units-change", ((e: CustomEvent<{ unit?: string; toggleId?: string }>) => {
    if (!unitsListenerReady) return;
    const detail = e.detail;
    if (!detail?.unit) return;
    if (detail.toggleId && detail.toggleId !== "hat") return;
    const nextU = draftUnitFromToggleDetail(detail.unit);
    const prevU = activeUnit;
    if (nextU === prevU) {
      updateFloatingLabels(nextU);
      refreshHatSizeDropdownLabels(nextU);
      refreshFitLengthLabels(nextU);
      return;
    }
    if (stitchGaugeInput && rowGaugeInput) {
      gaugeSlots[prevU] = {
        stitch: stitchGaugeInput.value,
        row: rowGaugeInput.value,
      };
    }
    gaugeSlots = maybeFillHatGaugeSlotFromOtherUnit(gaugeSlots, prevU, nextU);
    activeUnit = nextU;
    persistHatUnitKey(nextU);
    applyGaugeInputsFromActiveSlot();
    updateFloatingLabels(nextU);
    refreshHatSizeDropdownLabels(nextU);
    refreshFitLengthLabels(nextU);
    hideGaugeSanityWarning(document);
    onFieldChanged();
  }) as EventListener);

  createPatternBtn?.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
  });

  function submitHatPattern(): void {
    if (isSubmitting || !createPatternBtn) return;
    isSubmitting = true;
    createPatternBtn.classList.add("button-disabled");
    createPatternBtn.setAttribute("aria-disabled", "true");

    syncCanonicalDraft();
    const saved = readHatDraft();
    if (!saved) {
      isSubmitting = false;
      updateCtaUi();
      showFeedback(HAT_BUILDER_INCOMPLETE_MESSAGE);
      return;
    }

    window.location.assign(HAT_SUMMARY_FROM_BUILDER_HREF);
  }

  createPatternBtn?.addEventListener("click", () => {
    if (isSubmitting) return;

    if (stitchGaugeInput && rowGaugeInput) {
      gaugeSlots[activeUnit] = {
        stitch: stitchGaugeInput.value,
        row: rowGaugeInput.value,
      };
    }
    const fields = snapshotFields();
    syncNeedleCapacityFeedback(fields);
    if (!isHatBuilderReadyToCreatePattern(fields, sizingRows, activeUnit)) {
      const capacity = evaluateHatBuilderNeedleCapacity(fields, sizingRows, activeUnit);
      const message =
        !capacity.ok && capacity.message
          ? capacity.message
          : HAT_BUILDER_INCOMPLETE_MESSAGE;
      // Stay on builder; do not write over a previously valid draft from this click.
      hideGaugeSanityWarning(document);
      showFeedback(message);
      focusFirstIncompleteStep(fields);
      return;
    }

    const sanityGate = evaluateHatBuilderGaugeSanityGate(fields, activeUnit, acknowledgedGaugeKey);
    if (!sanityGate.proceed) {
      maxReachable = Math.max(maxReachable, 5);
      goToStep(5);
      renderGaugeSanityWarning(document, sanityGate.sanity, {
        onContinue: () => {
          acknowledgedGaugeKey = sanityGate.acknowledgementKey;
          hideGaugeSanityWarning(document);
          submitHatPattern();
        },
      });
      return;
    }

    hideGaugeSanityWarning(document);
    submitHatPattern();
  });

  el<HTMLButtonElement>("hat-builder-start-over")?.addEventListener("click", () => {
    draft = startOverHatBuilderSession({ unit: activeUnit, showTips: draft.showTips });
    gaugeSlots = {
      inches: { stitch: "", row: "" },
      cm: { stitch: "", row: "" },
    };
    hydrateFromDraft(draft);
    acknowledgedGaugeKey = null;
    hideGaugeSanityWarning(document);
    openStep = 1;
    refreshAccordionUi();
    showFeedback("");
  });

  // Hydrate after UnitToggle's DOMContentLoaded init (same tick order: toggle first).
  hydrateFromDraft(draft);
  syncUnitToggleUi(activeUnit);
  unitsListenerReady = true;

  // Open furthest incomplete step for returning visitors.
  const fields0 = snapshotFields();
  maxReachable = maxReachableFromChoices(fields0);
  openStep = 1;
  for (let step = 1; step <= STEPS; step += 1) {
    if (!hatBuilderStepComplete(step, fields0, sizingRows, activeUnit)) {
      openStep = Math.min(step, maxReachable);
      break;
    }
    openStep = step;
  }
  refreshAccordionUi();
}

function boot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initHatBuilderPage(), { once: true });
  } else {
    void initHatBuilderPage();
  }
}

boot();
