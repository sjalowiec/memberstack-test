/**
 * Basic Socks Builder client (`/patterns/socks/builder`).
 * Canonical draft: kbm_socks_draft. Summary / Pattern pages are not part of this pass.
 */
import {
  createEmptySockDraft,
  readSockDraft,
  syncSockDraft,
  writeSockDraft,
  type SockConstructionDirection,
  type SockDraft,
  type SockDraftUnit,
} from "../lib/patterns/sock/sockDraft";
import {
  applySockNewSessionFromUrl,
  startOverSockBuilderSession,
} from "../lib/patterns/sock/sockFreshStart";
import {
  convertSockMeasurementDisplay,
  draftUnitFromToggleDetail,
  maybeFillSockGaugeSlotFromOtherUnit,
  type SockGaugeSlots,
} from "../lib/patterns/sock/sockBuilderUnits";
import {
  SOCK_BUILDER_INCOMPLETE_MESSAGE,
  SOCK_BUILDER_STEPS,
  SOCK_BUILDER_SUMMARY_NOT_READY_MESSAGE,
  evaluateSockBuilderCalc,
  evaluateSockBuilderGaugeSanityGate,
  evaluateSockBuilderNeedleCapacity,
  isSockBuilderCtaEnabled,
  measurementsFromSockSize,
  nextSockBuilderOpenStepAfterFieldChange,
  sockBuilderChoiceFieldAdvances,
  sockBuilderStepComplete,
  type SockBuilderFieldSnapshot,
} from "../lib/patterns/sock/sockBuilderValidation";
import { hideGaugeSanityWarning, renderGaugeSanityWarning } from "../lib/patterns/gaugeSanityUi";
import { SOCK_AVAILABLE_NEEDLES_INPUT_ID } from "../lib/patterns/sock/sockAvailableNeedles";
import { syncExpressNeedleBlockVisibility } from "../lib/patterns/expressBuilderReviewSubmit";
import {
  bindAvailableNeedlesFieldValidation,
  setAvailableNeedlesFieldErrorState,
} from "../lib/patterns/availableNeedlesFieldValidation";
import { focusFirstInputInSection } from "../lib/patterns/focusFirstInputInSection";
import { isValidExpressAvailableNeedles } from "../lib/patterns/sleevelessExpressAvailableNeedles";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";
import {
  buildSockSizeOptionLabel,
  createSockSizingAdapter,
  sockSizeDisplayName,
  type SockSizingAdapter,
} from "../lib/patterns/sock/sockSizing";

const STEPS = SOCK_BUILDER_STEPS;

const CONSTRUCTION_LABELS: Record<SockConstructionDirection, string> = {
  "cuff-to-toe": "Cuff to Toe",
  "toe-up": "Toe Up",
};

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

function loadSizingAdapterFromPage(): SockSizingAdapter {
  const node = document.getElementById("socks-sizing-chart");
  if (!node?.textContent?.trim()) return createSockSizingAdapter([]);
  try {
    return createSockSizingAdapter(JSON.parse(node.textContent) as unknown);
  } catch {
    return createSockSizingAdapter([]);
  }
}

function syncUnitToggleUi(unit: SockDraftUnit): void {
  const wrap = document.querySelector<HTMLElement>('[data-unit-toggle="socks"]');
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

function normalizeConstructionDirection(raw: string): SockConstructionDirection | "" {
  return raw === "cuff-to-toe" || raw === "toe-up" ? raw : "";
}

async function initSocksBuilderPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-socks-builder]");
  if (!root) return;

  const socksSizeSelect = el<HTMLSelectElement>("socks-size");
  const footCircInput = el<HTMLInputElement>("socks-foot-circumference");
  const footLengthInput = el<HTMLInputElement>("socks-foot-length");
  const legCircInput = el<HTMLInputElement>("socks-leg-circumference");
  const legLengthInput = el<HTMLInputElement>("socks-leg-length");
  const constructionSelect = el<HTMLSelectElement>("socks-construction");
  const stitchGaugeInput = el<HTMLInputElement>("socks-stitch-gauge");
  const rowGaugeInput = el<HTMLInputElement>("socks-row-gauge");
  const availableNeedlesInput = el<HTMLInputElement>(SOCK_AVAILABLE_NEEDLES_INPUT_ID);
  const needleCapacityErrorEl = el<HTMLElement>("socks-needle-capacity-error");
  const createPatternBtn = el<HTMLButtonElement>("create-pattern-btn");
  const feedbackEl = el<HTMLElement>("create-pattern-feedback");

  const adapter = loadSizingAdapterFromPage();
  let gaugeSlots: SockGaugeSlots = {
    inches: { stitch: "", row: "" },
    cm: { stitch: "", row: "" },
  };
  let activeUnit: SockDraftUnit = "inches";
  let openStep = 1;
  let maxReachable = 1;
  let feedbackTimer = 0;
  let suppressPersist = false;
  let unitsListenerReady = false;
  let isSubmitting = false;
  let acknowledgedGaugeKey: string | null = null;

  await reconcilePatternDraftOwner();
  applySockNewSessionFromUrl();
  let draft: SockDraft = readSockDraft() ?? createEmptySockDraft();
  if (!readSockDraft()) {
    writeSockDraft(draft);
  }
  activeUnit = draft.unit === "cm" ? "cm" : "inches";
  syncUnitToggleUi(activeUnit);
  gaugeSlots = {
    inches: { ...draft.gaugeSlots.inches },
    cm: { ...draft.gaugeSlots.cm },
  };

  function snapshotFields(): SockBuilderFieldSnapshot {
    return {
      sizeSel: readSelectValue(socksSizeSelect),
      constructionDirection: readSelectValue(constructionSelect),
      footCircumference: footCircInput?.value ?? "",
      footLength: footLengthInput?.value ?? "",
      legCircumference: legCircInput?.value ?? "",
      legLength: legLengthInput?.value ?? "",
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
    draft = syncSockDraft({
      unit: u,
      sizeSel: fields.sizeSel,
      constructionDirection: normalizeConstructionDirection(fields.constructionDirection),
      footCircumference: fields.footCircumference,
      footLength: fields.footLength,
      legCircumference: fields.legCircumference,
      legLength: fields.legLength,
      gaugeSlots,
      availableNeedles: fields.availableNeedles,
    });
  }

  function syncNeedleBlockVisibility(fields: SockBuilderFieldSnapshot = snapshotFields()): void {
    const stitchRowOk =
      Number(fields.stitchGauge.trim()) > 0 && Number(fields.rowGauge.trim()) > 0;
    syncExpressNeedleBlockVisibility(document, stitchRowOk);
  }

  function syncNeedleCapacityFeedback(fields: SockBuilderFieldSnapshot = snapshotFields()): void {
    const capacity = evaluateSockBuilderNeedleCapacity(fields, activeUnit);
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

  function syncSizeSelectCompletion(): void {
    const wrap = socksSizeSelect?.closest(".hat-select-wrap");
    if (wrap) {
      wrap.classList.toggle("is-complete", readSelectValue(socksSizeSelect) !== "");
    }
  }

  function applyConstructionChoiceUi(): void {
    syncChoiceButtons("constructionDirection", readSelectValue(constructionSelect));
  }

  function applyGaugeInputsFromActiveSlot(): void {
    if (!stitchGaugeInput || !rowGaugeInput) return;
    stitchGaugeInput.value = gaugeSlots[activeUnit].stitch;
    rowGaugeInput.value = gaugeSlots[activeUnit].row;
  }

  function applyChartDefaultsForSelectedSize(): void {
    const defaults = measurementsFromSockSize(readSelectValue(socksSizeSelect), adapter, activeUnit);
    if (!defaults) return;
    if (footCircInput) footCircInput.value = defaults.footCircumference;
    if (footLengthInput) footLengthInput.value = defaults.footLength;
    if (legCircInput) legCircInput.value = defaults.legCircumference;
    if (legLengthInput) legLengthInput.value = defaults.legLength;
  }

  function updateFloatingLabels(unit: SockDraftUnit): void {
    const unitWord = unit === "cm" ? "cm" : "inches";
    const labels: Array<[string, string]> = [
      ["socks-foot-circumference", `Foot Circumference (${unitWord})`],
      ["socks-foot-length", `Foot Length (${unitWord})`],
      ["socks-leg-circumference", `Leg Circumference (${unitWord})`],
      ["socks-leg-length", `Leg Length (${unitWord})`],
    ];
    for (const [id, text] of labels) {
      const lab = document.querySelector(`label[for="${id}"]`);
      if (lab) lab.textContent = text;
    }
    if (socksSizeSelect) {
      socksSizeSelect.setAttribute("aria-label", `Choose a finished sock size (${unitWord})`);
      const firstOpt = socksSizeSelect.options[0];
      if (firstOpt && firstOpt.value === "") {
        firstOpt.textContent = `Choose a finished sock size (${unitWord})...`;
      }
    }
  }

  function refreshSockSizeDropdownLabels(unit: SockDraftUnit): void {
    if (!socksSizeSelect) return;
    Array.from(socksSizeSelect.options).forEach((opt) => {
      const v = opt.value;
      if (!v) return;
      const row = adapter.measurements.find((s) => s.size === v);
      if (!row) return;
      opt.textContent = buildSockSizeOptionLabel(row, unit);
    });
  }

  function hydrateFromDraft(d: SockDraft): void {
    suppressPersist = true;
    activeUnit = d.unit === "cm" ? "cm" : "inches";
    gaugeSlots = {
      inches: { ...d.gaugeSlots.inches },
      cm: { ...d.gaugeSlots.cm },
    };

    setSelectValue(socksSizeSelect, d.sizeSel);
    if (footCircInput) footCircInput.value = d.footCircumference;
    if (footLengthInput) footLengthInput.value = d.footLength;
    if (legCircInput) legCircInput.value = d.legCircumference;
    if (legLengthInput) legLengthInput.value = d.legLength;
    setSelectValue(constructionSelect, d.constructionDirection);
    applyGaugeInputsFromActiveSlot();
    if (availableNeedlesInput) availableNeedlesInput.value = d.availableNeedles ?? "";

    applyConstructionChoiceUi();
    syncSizeSelectCompletion();
    updateFloatingLabels(activeUnit);
    refreshSockSizeDropdownLabels(activeUnit);
    suppressPersist = false;
  }

  function summaryForStep(step: number, fields: SockBuilderFieldSnapshot): string {
    switch (step) {
      case 1: {
        if (!fields.sizeSel) return "";
        const row = adapter.measurements.find((s) => s.size === fields.sizeSel);
        return row ? sockSizeDisplayName(row) : fields.sizeSel;
      }
      case 2: {
        if (!fields.footCircumference.trim() || !fields.footLength.trim()) return "";
        const unitMark = activeUnit === "cm" ? " cm" : '"';
        return `${fields.footCircumference.trim()}${unitMark} foot · ${fields.footLength.trim()}${unitMark} long`;
      }
      case 3: {
        const dir = normalizeConstructionDirection(fields.constructionDirection);
        return dir ? CONSTRUCTION_LABELS[dir] : "";
      }
      case 4: {
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

  function maxReachableFromChoices(fields: SockBuilderFieldSnapshot): number {
    let max = 1;
    for (let step = 1; step < STEPS; step += 1) {
      if (!sockBuilderStepComplete(step, fields, adapter, activeUnit)) break;
      max = step + 1;
    }
    if (sockBuilderStepComplete(STEPS, fields, adapter, activeUnit)) max = STEPS;
    return max;
  }

  function refreshAccordionUi(): void {
    const fields = snapshotFields();
    maxReachable = maxReachableFromChoices(fields);
    if (openStep > maxReachable) openStep = maxReachable;
    syncNeedleBlockVisibility(fields);
    syncNeedleCapacityFeedback(fields);

    const summaryKeys = ["size", "measurements", "construction", "gauge"] as const;

    for (let step = 1; step <= STEPS; step += 1) {
      const sectionEl = stepSection(step);
      if (!sectionEl) continue;
      const complete = sockBuilderStepComplete(step, fields, adapter, activeUnit);
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
      if (body) body.hidden = !open;
      if (lockedFb) lockedFb.hidden = !locked;

      const summaryEl = sectionEl.querySelector<HTMLElement>(
        `[data-express-summary="${summaryKeys[step - 1]}"]`,
      );
      if (summaryEl) summaryEl.textContent = complete ? summaryForStep(step, fields) : "";
    }

    document.querySelectorAll<HTMLButtonElement>("[data-pill-step]").forEach((btn) => {
      const step = Number(btn.getAttribute("data-pill-step") || "0");
      const reachable = step <= maxReachable;
      const current = step === openStep;
      const complete = sockBuilderStepComplete(step, fields, adapter, activeUnit);
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

  function updateCtaUi(fields: SockBuilderFieldSnapshot = snapshotFields()): void {
    const ready = isSockBuilderCtaEnabled(fields, adapter, activeUnit);
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

  function focusFirstIncompleteStep(fields: SockBuilderFieldSnapshot): void {
    for (let step = 1; step <= STEPS; step += 1) {
      if (sockBuilderStepComplete(step, fields, adapter, activeUnit)) continue;
      maxReachable = Math.max(maxReachable, step);
      goToStep(step);
      const sectionEl = stepSection(step);
      if (sectionEl) focusFirstInputInSection(sectionEl);
      return;
    }
  }

  function onFieldChanged(opts?: { advance?: boolean }): void {
    syncCanonicalDraft();
    applyConstructionChoiceUi();
    syncSizeSelectCompletion();
    const fields = snapshotFields();
    const prevMax = maxReachable;
    refreshAccordionUi();
    const nextOpen = nextSockBuilderOpenStepAfterFieldChange({
      advance: Boolean(opts?.advance),
      openStep,
      maxReachableAfter: maxReachable,
      prevMaxReachable: prevMax,
      currentStepComplete: sockBuilderStepComplete(openStep, fields, adapter, activeUnit),
      totalSteps: STEPS,
    });
    if (nextOpen !== openStep) goToStep(nextOpen);
  }

  socksSizeSelect?.addEventListener("change", () => {
    applyChartDefaultsForSelectedSize();
    onFieldChanged({ advance: true });
  });
  footCircInput?.addEventListener("input", () => onFieldChanged());
  footCircInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
  footLengthInput?.addEventListener("input", () => onFieldChanged());
  footLengthInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
  legCircInput?.addEventListener("input", () => onFieldChanged());
  legCircInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
  legLengthInput?.addEventListener("input", () => onFieldChanged());
  legLengthInput?.addEventListener("change", () => onFieldChanged({ advance: true }));
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
      if (field === "constructionDirection") setSelectValue(constructionSelect, value);
      onFieldChanged({ advance: sockBuilderChoiceFieldAdvances(field) });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-express-header]").forEach((header) => {
    const activate = () => {
      const sec = header.closest<HTMLElement>("[data-express-step]");
      const step = Number(sec?.getAttribute("data-express-step") || "0");
      if (step >= 1 && step <= maxReachable) {
        goToStep(step);
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
    if (detail.toggleId && detail.toggleId !== "socks") return;
    const nextU = draftUnitFromToggleDetail(detail.unit);
    const prevU = activeUnit;
    if (nextU === prevU) {
      updateFloatingLabels(nextU);
      refreshSockSizeDropdownLabels(nextU);
      return;
    }
    if (stitchGaugeInput && rowGaugeInput) {
      gaugeSlots[prevU] = {
        stitch: stitchGaugeInput.value,
        row: rowGaugeInput.value,
      };
    }
    gaugeSlots = maybeFillSockGaugeSlotFromOtherUnit(gaugeSlots, prevU, nextU);
    if (footCircInput) {
      footCircInput.value = convertSockMeasurementDisplay(footCircInput.value, prevU, nextU);
    }
    if (footLengthInput) {
      footLengthInput.value = convertSockMeasurementDisplay(footLengthInput.value, prevU, nextU);
    }
    if (legCircInput) {
      legCircInput.value = convertSockMeasurementDisplay(legCircInput.value, prevU, nextU);
    }
    if (legLengthInput) {
      legLengthInput.value = convertSockMeasurementDisplay(legLengthInput.value, prevU, nextU);
    }
    activeUnit = nextU;
    applyGaugeInputsFromActiveSlot();
    updateFloatingLabels(nextU);
    refreshSockSizeDropdownLabels(nextU);
    hideGaugeSanityWarning(document);
    onFieldChanged();
  }) as EventListener);

  createPatternBtn?.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
  });

  function persistSocksBuilderChoices(): void {
    if (isSubmitting || !createPatternBtn) return;
    isSubmitting = true;
    createPatternBtn.classList.add("button-disabled");
    createPatternBtn.setAttribute("aria-disabled", "true");

    syncCanonicalDraft();
    const saved = readSockDraft();
    isSubmitting = false;
    updateCtaUi();
    if (!saved) {
      showFeedback(SOCK_BUILDER_INCOMPLETE_MESSAGE);
      return;
    }
    showFeedback(SOCK_BUILDER_SUMMARY_NOT_READY_MESSAGE);
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

    if (!isSockBuilderCtaEnabled(fields, adapter, activeUnit)) {
      const capacity = evaluateSockBuilderNeedleCapacity(fields, activeUnit);
      const message =
        !capacity.ok && capacity.message ? capacity.message : SOCK_BUILDER_INCOMPLETE_MESSAGE;
      hideGaugeSanityWarning(document);
      showFeedback(message);
      focusFirstIncompleteStep(fields);
      return;
    }

    const sanityGate = evaluateSockBuilderGaugeSanityGate(fields, activeUnit, acknowledgedGaugeKey);
    if (!sanityGate.proceed) {
      maxReachable = Math.max(maxReachable, STEPS);
      goToStep(STEPS);
      renderGaugeSanityWarning(document, sanityGate.sanity, {
        onContinue: () => {
          acknowledgedGaugeKey = sanityGate.acknowledgementKey;
          hideGaugeSanityWarning(document);
          const afterAck = evaluateSockBuilderCalc(fields, activeUnit);
          if (!afterAck.ok) {
            showFeedback(afterAck.errors[0] ?? SOCK_BUILDER_INCOMPLETE_MESSAGE);
            return;
          }
          persistSocksBuilderChoices();
        },
      });
      return;
    }

    const calc = evaluateSockBuilderCalc(fields, activeUnit);
    if (!calc.ok) {
      hideGaugeSanityWarning(document);
      showFeedback(calc.errors[0] ?? SOCK_BUILDER_INCOMPLETE_MESSAGE);
      return;
    }

    hideGaugeSanityWarning(document);
    persistSocksBuilderChoices();
  });

  el<HTMLButtonElement>("socks-builder-start-over")?.addEventListener("click", () => {
    draft = startOverSockBuilderSession({ unit: activeUnit });
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

  hydrateFromDraft(draft);
  syncUnitToggleUi(activeUnit);
  unitsListenerReady = true;

  const fields0 = snapshotFields();
  maxReachable = maxReachableFromChoices(fields0);
  openStep = 1;
  for (let step = 1; step <= STEPS; step += 1) {
    if (!sockBuilderStepComplete(step, fields0, adapter, activeUnit)) {
      openStep = Math.min(step, maxReachable);
      break;
    }
    openStep = step;
  }
  refreshAccordionUi();
}

function boot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initSocksBuilderPage(), { once: true });
  } else {
    void initSocksBuilderPage();
  }
}

boot();
