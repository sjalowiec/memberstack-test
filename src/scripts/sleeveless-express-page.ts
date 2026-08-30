/**
 * Express Pattern wizard (/patterns/sleeveless-express): accordion steps + shared GaugeInput (ids express-stitch-gauge / express-row-gauge).
 */
import { initPatternTabs } from "../lib/patterns/patternTabsClient";
import {
  getPatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "../lib/patterns/patternStorage";
import {
  applySleevelessExpressEditChoicesFromUrl,
  isSleevelessExpressEditChoicesSearchParams,
} from "../lib/patterns/restoreSleevelessExpressBuilderFromPattern";
import { startNewCustomPatternFromExpress } from "../lib/patterns/startNewCustomPatternWorkflow";
import {
  applySleevelessExpressNewSessionFromUrl,
  isSleevelessExpressNewSessionSearchParams,
} from "../lib/patterns/sleevelessExpressFreshStart";
import { resolveSleevelessUserAccess } from "../lib/patterns/sleevelessPatternSystemAccessClient";
import { canEditPatternSettingsForSystem } from "../lib/patterns/sleevelessPatternSystemAccess";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";
import { exitEditingSavedCustomPattern } from "../lib/patterns/customPatternEditingBannerActions";
import { OPEN_PATTERN_HREF } from "../lib/patterns/customPatternProjectNavigation";
import { resolveExpressBuilderPostBuildHref } from "../lib/patterns/expressBuilderPostBuildRouting";
import {
  processPatternBuilderPurchaseReturn,
  stripPatternBuilderPurchaseReturnParams,
} from "../lib/patterns/patternBuilderLifetimePurchaseReturn";
import {
  setPendingUpgradeCheckoutError,
  showPatternBuilderUnlockedConfirmation,
} from "../lib/patterns/patternBuilderNewPatternUpgradeScreen";
import {
  canStartNewPatternForSystem,
  resolveNewPatternBlockedCopy,
  showSleevelessNewPatternLockedScreen,
} from "../lib/patterns/sleevelessNewPatternAccessGuard";
import { resolvePatternSystemForBuilderGate, resolvePatternSystemForEntitlement } from "../lib/patterns/patternSystemId";
import { logPatternEditGateDebug } from "../lib/patterns/patternEditGateDebug";
import {
  garmentTypeFromFront,
  writeSleevelessGarmentTypeLocalStorage,
} from "../lib/patterns/writeSleevelessGarmentSelection";
import { formatSwatchCountForGaugeInput } from "../lib/patterns/gaugeDisplayFormat";
import { applyFitEaseUnitLabels } from "../lib/patterns/fitEaseUnitLabels";
import {
  loadExpressSweaterCharts,
  expressWhoToChartAudience,
  resolveExpressChartFit,
  findExpressChartRow,
  formatExpressSelectedSizeSummary,
  getExpressUiUnit,
  nonEmptyTrimmed,
  refreshExpressSizePanel,
  patchExpressSizeBodyConfirmation,
  isValidExpressSizeForAudience,
  SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import { scrollToSectionWithHeaderOffset } from "../lib/patterns/scrollToSectionWithHeaderOffset";
import { focusFirstInputInSection } from "../lib/patterns/focusFirstInputInSection";
import {
  getExpressEditingProjectLabel,
  hasExpressResumeProgress,
  isExpressEditChoicesReopenSession,
  loadExpressPersisted,
} from "../lib/patterns/sleevelessExpressResume";
import { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT } from "../lib/patterns/customPatternEditingEvents";
import { isEditingSavedCustomPatternProject } from "../lib/patterns/customPatternEditingUx";
import { ensureSavedCustomPatternSessionHydratedOnExpressPage } from "../lib/patterns/hydrateSavedCustomPatternProject";
import {
  enforceLockedExpressWhoInWizardValues,
  interceptBlockedExpressWhoChange,
  syncSavedPatternChartAudienceLockUi,
} from "../lib/patterns/savedCustomPatternChartAudienceLock";
import { syncSleevelessBuilderHeaderTitle } from "../lib/patterns/sleevelessBuilderHeaderUx";
import {
  EXPRESS_AVAILABLE_NEEDLES_INPUT_ID,
  resolveExpressAvailableNeedlesForResume,
} from "../lib/patterns/sleevelessExpressAvailableNeedles";
import {
  bindAvailableNeedlesFieldValidation,
  clearAvailableNeedlesFieldErrorIfValid,
  getAvailableNeedlesInputById,
  validateAvailableNeedlesFieldValue,
} from "../lib/patterns/availableNeedlesFieldValidation";
import {
  computeExpressGaugeStepComplete,
  isExpressReviewCtaReady,
  syncExpressNeedleBlockVisibility,
  wireExpressBuilderReviewSubmit,
} from "../lib/patterns/expressBuilderReviewSubmit";
import { wireExpressSweaterSizingChartLink } from "../lib/reference/sweaterSizingChartNavigation";
import {
  rawSwatchToPerInch,
  resolveExpressGaugeFieldsForPersist,
  syncExpressWizardToPatternStorage,
} from "../lib/patterns/syncExpressWizardToPatternStorage";
import { DROP_SHOULDER_CONSTRUCTION } from "../lib/patterns/patternConstructionIdentity";
import {
  buildDropShoulderReviewDisplayIdentity,
  markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged,
} from "../lib/patterns/dropShoulderReviewDiagramRefresh";

const STEPS = 5;
const LOCKED_STEP_NAV_TITLE = "Finish the previous step to continue.";

const LABELS: Record<string, Record<string, string>> = {
  who: { women: "Women", men: "Men", kids: "Kids", baby: "Baby" },
  front: { closed: "Pullover", open: "Cardigan" },
  neckline: { round: "Round", "v-neck": "V-neck" },
  fit: { close: "Close", standard: "Standard", relaxed: "Relaxed" },
};

const GAUGE_STITCH_ID = "express-stitch-gauge";
const GAUGE_ROW_ID = "express-row-gauge";

function readExpressAvailableNeedlesInput(): string {
  const el = document.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID);
  return el instanceof HTMLInputElement ? el.value.trim() : "";
}

function getExpressGaugeUnit(): "cm" | "in" {
  return getExpressUiUnit();
}

/** Page construction flag (`drop-shoulder`) for Express review/diagram identity. */
function expressPageConstruction(): string {
  return (
    document
      .querySelector<HTMLElement>("[data-express-construction]")
      ?.getAttribute("data-express-construction")
      ?.trim() || ""
  );
}

function mapExpressStyle(styleKey: string) {
  switch (styleKey) {
    case "straight-pullover":
      return { bodyShape: "straight", frontStyle: "closed" as const };
    case "shaped-pullover":
      return { bodyShape: "aline", frontStyle: "closed" as const };
    case "straight-cardigan":
      return { bodyShape: "straight", frontStyle: "open" as const };
    case "shaped-cardigan":
      return { bodyShape: "aline", frontStyle: "open" as const };
    case "waist-pullover":
      return { bodyShape: "waist", frontStyle: "closed" as const };
    case "waist-cardigan":
      return { bodyShape: "waist", frontStyle: "open" as const };
    default:
      return { bodyShape: "straight", frontStyle: "closed" as const };
  }
}

/** Canonical Express style key from Custom Builder–aligned shape + front picks. */
function deriveExpressStyleKey(shape?: string, front?: string): string {
  if (!shape || !front) return "";
  if (shape === "straight" && front === "closed") return "straight-pullover";
  if (shape === "aline" && front === "closed") return "shaped-pullover";
  if (shape === "straight" && front === "open") return "straight-cardigan";
  if (shape === "aline" && front === "open") return "shaped-cardigan";
  if (shape === "waist" && front === "closed") return "waist-pullover";
  if (shape === "waist" && front === "open") return "waist-cardigan";
  return "";
}

/** Hydrate shape/front from legacy persisted `style` single-field sessions. */
function migrateExpressStyleFields(v: Record<string, string>): void {
  if (v.shape && v.front) {
    const derived = deriveExpressStyleKey(v.shape, v.front);
    if (derived) v.style = derived;
    return;
  }
  const s = v.style;
  if (!s) return;
  const legacy: Record<string, [string, string]> = {
    "straight-pullover": ["straight", "closed"],
    "shaped-pullover": ["aline", "closed"],
    "straight-cardigan": ["straight", "open"],
    "shaped-cardigan": ["aline", "open"],
    "waist-pullover": ["waist", "closed"],
    "waist-cardigan": ["waist", "open"],
  };
  const pair = legacy[s];
  if (pair) {
    v.shape = pair[0];
    v.front = pair[1];
  }
}

/** Express only offers straight body; front pullover vs cardigan is chosen on step 2. */
function ensureExpressStyleDefaults(v: Record<string, string>): void {
  v.shape = "straight";
  const derived = deriveExpressStyleKey(v.shape, v.front);
  if (derived) v.style = derived;
  else delete v.style;
}

function mapExpressNeckline(n: string) {
  return n === "v-neck" ? "v" : "round";
}

function isValidPositiveNumber(v: string) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0 && Number.isFinite(n);
}

function persistExpressBuilderState(
  values: Record<string, string>,
  chartFit: { selectedSize: string; selectedMeasurements: Record<string, number> } | null,
) {
  syncExpressWizardToPatternStorage(values, chartFit);
}

function stepSection(step: number): HTMLElement | null {
  return document.querySelector(`[data-express-step="${step}"]`);
}

function gaugeOk(): boolean {
  const st = document.getElementById(GAUGE_STITCH_ID);
  const rw = document.getElementById(GAUGE_ROW_ID);
  if (!(st instanceof HTMLInputElement) || !(rw instanceof HTMLInputElement)) return false;
  return isValidPositiveNumber(st.value) && isValidPositiveNumber(rw.value);
}

function needlesOk(): boolean {
  return validateAvailableNeedlesFieldValue(readExpressAvailableNeedlesInput()).valid;
}

/** Gauge step complete: swatch gauge + available needles when the field is present. */
function gaugeStepOk(): boolean {
  return computeExpressGaugeStepComplete(gaugeOk(), needlesOk(), document);
}

function formatGaugeSummary(): string {
  const st = document.getElementById(GAUGE_STITCH_ID);
  const rw = document.getElementById(GAUGE_ROW_ID);
  if (!(st instanceof HTMLInputElement) || !(rw instanceof HTMLInputElement)) return "";
  if (!gaugeOk()) return "";
  const s = parseFloat(st.value.trim());
  const r = parseFloat(rw.value.trim());
  if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(r) || r <= 0) return "";
  const unit = getExpressGaugeUnit();
  const over = unit === "cm" ? "10 cm" : '4"';
  return `${Math.round(s)} sts × ${Math.round(r)} rows over ${over}`;
}

function initExpressPage() {
  wireExpressSweaterSizingChartLink(window.location.pathname);
  const startedFreshSession = applySleevelessExpressNewSessionFromUrl();
  if (!startedFreshSession) {
    applySleevelessExpressEditChoicesFromUrl();
  }
  if (!startedFreshSession && isEditingSavedCustomPatternProject()) {
    ensureSavedCustomPatternSessionHydratedOnExpressPage();
  }
  const persisted = startedFreshSession ? null : loadExpressPersisted();
  const editChoicesReopen = isExpressEditChoicesReopenSession(persisted);
  const values: Record<string, string> =
    persisted?.values && typeof persisted.values === "object" && !Array.isArray(persisted.values)
      ? { ...persisted.values }
      : {};
  migrateExpressStyleFields(values);
  if (!editChoicesReopen) {
    ensureExpressStyleDefaults(values);
  }
  enforceLockedExpressWhoInWizardValues(values);

  let openStepCandidate =
    typeof persisted?.openStep === "number" && Number.isFinite(persisted.openStep)
      ? Math.floor(persisted.openStep)
      : 1;
  if (
    persisted &&
    persisted.flowSteps !== 4 &&
    persisted.flowSteps !== 5 &&
    persisted.flowSteps !== 6 &&
    openStepCandidate > 1
  ) {
    openStepCandidate = openStepCandidate === 2 ? 2 : openStepCandidate - 1;
  }

  /** Legacy 4-step sessions: neckline was step 2, fit step 3, gauge step 4 — shift up after inserting Size at step 2. */
  if (persisted && persisted.flowSteps === 4 && openStepCandidate >= 2) {
    openStepCandidate += 1;
  }

  /** flowSteps 5 → 6: Front step inserted after Size (old steps 3–5 → 4–6). Skip when already on combined Who & Size layout. */
  if (
    persisted &&
    persisted.flowSteps === 5 &&
    !persisted.whoSizeCombined &&
    openStepCandidate >= 3
  ) {
    openStepCandidate += 1;
  }

  /** flowSteps 6 → 5: Who + Size merged into one accordion (old steps 2–6 → new 1–5). */
  if (persisted && persisted.flowSteps === 6) {
    if (openStepCandidate <= 2) openStepCandidate = 1;
    else openStepCandidate -= 1;
  }

  let maxReachable = editChoicesReopen ? STEPS : maxReachableFromChoices();
  let openStep = editChoicesReopen
    ? Math.min(STEPS, Math.max(1, openStepCandidate || STEPS))
    : Math.min(maxReachable, Math.max(0, openStepCandidate));

  /**
   * Tracks the Gauge accordion's open state across `updateSections` runs so we only move focus
   * on a genuine closed→open transition (not on every state refresh, gauge typing, or initial load).
   * Seeded from the initial open state so a resumed session that lands on Gauge does not steal focus.
   */
  let gaugeAccordionWasOpen = openStep === STEPS;

  const sections = document.querySelectorAll("[data-express-step]");
  const pills = document.querySelectorAll("[data-pill-step]");
  const expressBuilderRoot = document.querySelector("[data-express-builder]");
  const audienceLockHost =
    expressBuilderRoot instanceof HTMLElement
      ? expressBuilderRoot
      : document.querySelector("[data-express-step='1']");

  const audienceLockActions = {
    onStartNewPattern: () => requestResetExpressBuilder(),
  };

  function syncExpressChartAudienceLockUi(): void {
    if (audienceLockHost instanceof HTMLElement) {
      syncSavedPatternChartAudienceLockUi(audienceLockHost, audienceLockActions);
    }
  }

  function persistExpressSession(): void {
    if (typeof localStorage === "undefined") return;
    const gaugeFields = resolveExpressGaugeFieldsForPersist();
    try {
      localStorage.setItem(
        SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
        JSON.stringify({
          values: { ...values },
          openStep,
          maxReachable,
          flowSteps: 5,
          whoSizeCombined: true,
          ...(editChoicesReopen ? { editChoicesReopen: true } : {}),
          ...gaugeFields,
        }),
      );
    } catch {
      /* quota */
    }
  }

  const prevMachineOnLoad =
    (getPatternData().yarnGaugeMachine as Record<string, unknown> | undefined) ?? {};
  const needlesElOnLoad = document.getElementById(EXPRESS_AVAILABLE_NEEDLES_INPUT_ID);
  if (needlesElOnLoad instanceof HTMLInputElement) {
    needlesElOnLoad.value = resolveExpressAvailableNeedlesForResume(
      typeof persisted?.availableNeedles === "string" ? persisted.availableNeedles : undefined,
      prevMachineOnLoad,
    );
  }

  if (persisted) {
    const stEl = document.getElementById(GAUGE_STITCH_ID);
    const rwEl = document.getElementById(GAUGE_ROW_ID);
    if (typeof persisted.gaugeStitchRaw === "string" && stEl instanceof HTMLInputElement) {
      stEl.value = persisted.gaugeStitchRaw;
    }
    if (typeof persisted.gaugeRowRaw === "string" && rwEl instanceof HTMLInputElement) {
      rwEl.value = persisted.gaugeRowRaw;
    }
    if (editChoicesReopen) {
      syncExpressWizardToPatternStorage(values, null, { preferDomGauge: false });
    }
  }

  function summaryText(field: string): string {
    if (field === "gauge") {
      const g = formatGaugeSummary();
      return g || "";
    }
    if (field === "frontNeckline") {
      const f = values.front ? LABELS.front[values.front] ?? values.front : "";
      const n = values.neckline ? LABELS.neckline[values.neckline] ?? values.neckline : "";
      return [f, n].filter(Boolean).join(" • ");
    }
    if (field === "who") {
      const whoKey = values.who;
      const whoLabel =
        whoKey && LABELS.who[whoKey] ? LABELS.who[whoKey] : whoKey ? String(whoKey) : "";
      return whoLabel || "";
    }
    if (field === "selectedSize") {
      return formatExpressSelectedSizeSummary(values);
    }
    const v = values[field];
    if (!v) return "";
    const map = LABELS[field];
    return map && map[v] ? map[v] : v;
  }

  /**
   * Completion for a single declared field. Drives both the per-step checkmarks and the
   * furthest-reachable calc, so it must stay layout-agnostic (the drop-shoulder builder reuses
   * this client with a different section order and a combined "front neckline" step).
   */
  function fieldComplete(field: string): boolean {
    if (field === "who") return !!values.who && nonEmptyTrimmed(values.selectedSize);
    if (field === "front") return nonEmptyTrimmed(values.front);
    if (field === "gauge") return gaugeStepOk();
    // Sleeve length always carries a valid default (drop-shoulder only), so it never blocks.
    if (field === "sleeveLength") {
      return !!document.querySelector(
        "[data-ds-sleeve-length-option].is-selected, [data-ds-sleeve-length-option][aria-pressed='true']",
      );
    }
    return !!values[field];
  }

  /** Fields a section requires, read from its space-separated `data-express-field`. */
  function stepRequiredFields(step: number): string[] {
    const sec = stepSection(step);
    const raw = sec?.getAttribute("data-express-field") ?? "";
    return raw.split(/\s+/).filter(Boolean);
  }

  function isStepComplete(step: number): boolean {
    const fields = stepRequiredFields(step);
    if (fields.length === 0) return false;
    return fields.every(fieldComplete);
  }

  /** Furthest step the user can open: 1 + the count of leading complete steps. */
  function maxReachableFromChoices(): number {
    let m = 1;
    for (let step = 1; step < STEPS; step += 1) {
      if (isStepComplete(step)) m = step + 1;
      else break;
    }
    return m;
  }

  function clearAllLockedFeedback() {
    document.querySelectorAll("[data-express-locked-feedback]").forEach((el) => {
      el.setAttribute("hidden", "");
    });
  }

  function showLockedFeedback(sectionEl: HTMLElement | null) {
    clearAllLockedFeedback();
    const fb = sectionEl?.querySelector("[data-express-locked-feedback]");
    if (fb) fb.removeAttribute("hidden");
  }

  function updateExpressSizeBodyConfirmation(): void {
    const root = resolveExpressBuilderRoot();
    if (!root) return;
    patchExpressSizeBodyConfirmation(root, values);
  }

  function updateSummaries() {
    document.querySelectorAll("[data-express-summary]").forEach((el) => {
      const key = el.getAttribute("data-express-summary");
      if (!key) return;
      el.textContent = summaryText(key);
    });
    updateExpressSizeBodyConfirmation();
  }

  /**
   * Single place for Generate Pattern visibility: uses in-memory `values` plus live gauge inputs.
   * Does not depend on which accordion is open (submit control lives outside the collapsible body).
   */
  function updateGeneratePatternAvailability(): void {
    const wrap = document.getElementById("express-generate-wrap");
    const btn = document.getElementById("express-generate");
    const wizardStepsComplete =
      !!values.who &&
      nonEmptyTrimmed(values.selectedSize) &&
      nonEmptyTrimmed(values.front) &&
      !!values.neckline &&
      !!values.fit;
    // CTA readiness is stitch/row gauge only; needles are validated on submit
    // so knitters get the required-field message instead of a silent disabled button.
    const reviewCtaReady = isExpressReviewCtaReady(wizardStepsComplete, gaugeOk());

    if (wrap) {
      if (reviewCtaReady) wrap.removeAttribute("hidden");
      else wrap.setAttribute("hidden", "");
    }
    if (btn instanceof HTMLButtonElement) btn.disabled = !reviewCtaReady;
  }

  function updatePills() {
    pills.forEach((btn) => {
      const step = parseInt(btn.getAttribute("data-pill-step") ?? "0", 10);
      const label = btn.getAttribute("data-pill-label") || `Step ${step}`;
      const complete = isStepComplete(step);
      const isCurrent = step === openStep;
      const item = btn.closest(".sg-builder-nav__item");

      btn.classList.toggle("is-complete", complete);
      btn.classList.toggle("is-current", isCurrent);
      btn.classList.toggle("is-upcoming", step > maxReachable);

      if (step > maxReachable) {
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("title", LOCKED_STEP_NAV_TITLE);
      } else {
        btn.removeAttribute("aria-disabled");
        btn.removeAttribute("title");
      }

      if (item) item.classList.toggle("active", isCurrent);

      if (isCurrent) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");

      if (complete) btn.setAttribute("aria-label", `${label}, completed`);
      else if (isCurrent) btn.setAttribute("aria-label", `${label}, current`);
      else if (step > maxReachable) btn.setAttribute("aria-label", `${label}, locked`);
      else btn.setAttribute("aria-label", label);
    });
  }

  function setBodyHidden(sectionEl: HTMLElement, hide: boolean) {
    const body = sectionEl.querySelector(".express-acc__body");
    if (!body) return;
    if (hide) body.setAttribute("hidden", "");
    else body.removeAttribute("hidden");
  }

  function refreshBuilderState(persist = true): void {
    maxReachable = editChoicesReopen ? STEPS : maxReachableFromChoices();
    if (openStep > maxReachable) openStep = maxReachable;
    if (openStep < 0) openStep = 0;
    updatePills();
    updateSections();
    if (persist) persistExpressSession();
  }

  function updateSections() {
    sections.forEach((el) => {
      const sectionEl = el as HTMLElement;
      const step = parseInt(sectionEl.getAttribute("data-express-step") ?? "0", 10);
      const open = isExpressSectionBodyOpen(step);
      const locked = step > maxReachable;
      const complete = isStepComplete(step);

      sectionEl.classList.toggle("express-acc--open", open);
      sectionEl.classList.toggle("express-acc--locked", locked);
      sectionEl.classList.toggle("express-acc--complete", complete);

      const header = sectionEl.querySelector("[data-express-header]");
      if (header) {
        header.setAttribute("aria-expanded", open ? "true" : "false");
        header.setAttribute("tabindex", "0");
      }

      const lockedFb = sectionEl.querySelector("[data-express-locked-feedback]");
      if (lockedFb && !locked) lockedFb.setAttribute("hidden", "");

      if (open) {
        setBodyHidden(sectionEl, false);
        sectionEl.removeAttribute("aria-hidden");
      } else {
        setBodyHidden(sectionEl, true);
      }

      if (step === STEPS) {
        const stIn = document.getElementById(GAUGE_STITCH_ID);
        const rwIn = document.getElementById(GAUGE_ROW_ID);
        [stIn, rwIn].forEach((inp) => {
          if (!(inp instanceof HTMLElement)) return;
          if (!open) inp.setAttribute("tabindex", "-1");
          else inp.removeAttribute("tabindex");
        });

        // Focus the first gauge input only on a closed→open transition so the user can type
        // immediately. Guarded so it never steals focus while closed or when another step opens.
        if (open && !gaugeAccordionWasOpen) {
          focusFirstInputInSection(sectionEl);
        }
        gaugeAccordionWasOpen = open;
      }
    });

    updateSummaries();
    syncExpressNeedleBlockVisibility(document, gaugeOk());
    updateGeneratePatternAvailability();
    applySelectionUI();
    syncExpressChartAudienceLockUi();
  }

  function openGaugeStepForValidation(): void {
    if (openStep !== STEPS) {
      goToStep(STEPS);
      return;
    }
    updateSections();
  }

  function goToStep(step: number) {
    if (step < 1 || step > STEPS) return;
    if (step > maxReachable) return;
    clearAllLockedFeedback();
    openStep = step;
    refreshBuilderState();
    // Reveal the just-opened section below the fixed site header (e.g. "Choose your front"),
    // so a sibling-collapse layout shift never leaves its content hidden under the header.
    scrollToSectionWithHeaderOffset(stepSection(step));
  }

  /** Deep-link from Measurement Blueprint “Change gauge” — opens Gauge accordion when prior steps are complete. */
  function applyExpressGaugeSectionHash(): void {
    let hash = "";
    try {
      hash = window.location.hash.slice(1);
    } catch {
      return;
    }
    if (hash !== "express-gauge-section") return;
    if (maxReachableFromChoices() < STEPS) return;
    goToStep(STEPS);
  }

  function markChoiceSelected(sectionEl: HTMLElement, selectedEl: HTMLElement) {
    const scope =
      selectedEl.closest(".hat-length-picker__grid") ??
      selectedEl.closest(".express-options--who") ??
      selectedEl.closest(".express-options") ??
      sectionEl;
    scope.querySelectorAll(".express-option, .express-style-card, .hat-length-picker__option").forEach((el) => {
      el.classList.remove("express-option--selected", "express-style-card--selected", "is-selected");
      if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", "false");
    });
    scope.querySelectorAll(".express-option[data-choice]").forEach((el) => {
      el.setAttribute("aria-pressed", el === selectedEl ? "true" : "false");
    });
    if (selectedEl.classList.contains("express-style-card")) {
      selectedEl.classList.add("express-style-card--selected");
    } else if (selectedEl.classList.contains("hat-length-picker__option")) {
      selectedEl.classList.add("is-selected");
      selectedEl.setAttribute("aria-pressed", "true");
    } else {
      selectedEl.classList.add("express-option--selected");
    }
  }

  /**
   * Who & Size single accordion: keep the size chart visible and interactive while this step is active
   * (`openStep === 1`). Collapse/disable chart interaction when navigating to Front (`openStep >= 2`) or all (`openStep === 0`).
   */
  function keepWhoSizeClusterExpanded(): boolean {
    if (!values.who) return false;
    if (openStep === 0 || openStep >= 2) return false;
    return true;
  }

  /** Size list/select is interactive on step 1 after a Who choice. */
  function canInteractWithSizeStep(): boolean {
    if (editChoicesReopen && openStep === 1 && values.who) return true;
    return keepWhoSizeClusterExpanded();
  }

  function canEditChoiceInSection(stepNum: number): boolean {
    if (editChoicesReopen) return stepNum >= 1 && stepNum <= STEPS;
    return stepNum === openStep || (keepWhoSizeClusterExpanded() && stepNum === 1);
  }

  function isExpressSectionBodyOpen(step: number): boolean {
    if (step === openStep) return true;
    if (keepWhoSizeClusterExpanded() && step === 1) return true;
    return false;
  }

  function resolveExpressBuilderRoot(): HTMLElement | null {
    const root = document.querySelector("[data-express-builder]");
    return root instanceof HTMLElement ? root : null;
  }

  function refreshExpressWhoSizePanel(): void {
    const root = resolveExpressBuilderRoot();
    if (!root) return;
    refreshExpressSizePanel(root, values, canInteractWithSizeStep());
  }

  /** Clears size only — uses same {@link maxReachableFromChoices} / accordion unlock rules as {@link selectExpressSize}. */
  function clearExpressSelectedSize(): void {
    if (!nonEmptyTrimmed(values.selectedSize)) return;
    delete values.selectedSize;
    clearAllLockedFeedback();
    refreshBuilderState();
  }

  function onExpressSizeSelectChange(ev: Event): void {
    const t = ev.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (!t.hasAttribute("data-express-size-select")) return;
    if (!canInteractWithSizeStep()) return;
    const v = t.value.trim();
    if (!v) {
      clearExpressSelectedSize();
      return;
    }
    selectExpressSize(v);
  }

  function applySelectionUI() {
    refreshExpressWhoSizePanel();
    const root = resolveExpressBuilderRoot() ?? document;
    (["who", "front", "neckline", "fit"] as const).forEach((field) => {
      const value = values[field];
      if (!value) return;
      const hit = root.querySelector(`[data-choice][data-field="${field}"][data-value="${value}"]`);
      if (!(hit instanceof HTMLElement)) return;
      const sec = hit.closest("[data-express-step]");
      if (sec instanceof HTMLElement) markChoiceSelected(sec, hit);
    });
  }

    function onChoiceClick(ev: Event) {
      const target = ev.target;
      if (!(target instanceof Element)) return;
    const btn = target.closest("[data-choice]");
    if (!btn) return;
    const sec = btn.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    const stepNum = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (!canEditChoiceInSection(stepNum)) return;

    const field = btn.getAttribute("data-field");
    const value = btn.getAttribute("data-value");
    if (!field || value == null) return;

    if (field === "who") {
      if (
        interceptBlockedExpressWhoChange(
          audienceLockHost instanceof HTMLElement ? audienceLockHost : null,
          value,
          audienceLockActions,
        )
      ) {
        return;
      }
      const prevWho = values.who;
      if (prevWho !== undefined && prevWho !== value) {
        delete values.selectedSize;
      }
    }

    if (field === "front") {
      if (value !== "closed" && value !== "open") return;
    }

    values[field] = value;
    if (field === "shape" || field === "front") {
      const derived = deriveExpressStyleKey(values.shape, values.front);
      if (derived) values.style = derived;
      else delete values.style;
    }

    if (field === "front") {
      const garmentType = garmentTypeFromFront(value);
      writeSleevelessGarmentTypeLocalStorage(garmentType);
      syncExpressWizardToPatternStorage(values, null);
    }

    markChoiceSelected(sec, btn as HTMLElement);

    if (field === "who") {
      refreshExpressWhoSizePanel();
    }

    clearAllLockedFeedback();
    refreshBuilderState();
  }

  /** Size picker — single source of truth: `values.selectedSize`. Unlocks Front (step 2)+ when set; does not auto-open neckline. */
  function selectExpressSize(sizeValue: string): void {
    const trimmed = String(sizeValue).trim();
    if (!trimmed) return;
    if (!canInteractWithSizeStep()) return;
    const aud = expressWhoToChartAudience(values.who);
    if (!isValidExpressSizeForAudience(aud, trimmed)) return;

    values.selectedSize = trimmed;

    if (expressPageConstruction() === DROP_SHOULDER_CONSTRUCTION) {
      markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
        buildDropShoulderReviewDisplayIdentity(aud, trimmed, values.fit || "standard"),
      );
    }

    refreshExpressWhoSizePanel();
    clearAllLockedFeedback();
    refreshBuilderState();
  }

  function onExpressSizeRowActivate(ev: Event) {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("[data-express-size-row]");
    if (!(row instanceof HTMLTableRowElement)) return;

    if (ev.type === "keydown") {
      if (!(ev instanceof KeyboardEvent)) return;
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
    }

    if (row.getAttribute("aria-disabled") === "true") return;
    if (!canInteractWithSizeStep()) return;
    const v = row.getAttribute("data-value")?.trim() ?? "";
    if (!v) return;
    selectExpressSize(v);
  }

  function onHeaderActivate(ev: Event) {
    const h = ev.currentTarget;
    if (!(h instanceof HTMLElement)) return;
    const sec = h.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    const step = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (step > maxReachable) {
      showLockedFeedback(sec);
      return;
    }
    if (openStep === step) {
      clearAllLockedFeedback();
      openStep = 0;
      refreshBuilderState();
      return;
    }
    goToStep(step);
  }

    function onHeaderKey(ev: Event) {
      if (!(ev instanceof KeyboardEvent)) return;
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        onHeaderActivate(ev);
      }
    }

    function onChevronClick(ev: Event) {
      ev.stopPropagation();
    const btn = ev.currentTarget;
    if (!(btn instanceof Element)) return;
    const sec = btn.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    const step = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (step > maxReachable) return;
    const header = sec.querySelector("[data-express-header]");
    if (header instanceof HTMLElement) onHeaderActivate({ currentTarget: header } as unknown as Event);
  }

    function onPillClick(ev: Event) {
      const el = ev.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    if (el.getAttribute("aria-disabled") === "true") return;
    const step = parseInt(el.getAttribute("data-pill-step") ?? "0", 10);
    if (step >= 1 && step <= maxReachable) {
      goToStep(step);
    }
  }

  function refreshGaugeStepUi(persist = true) {
    syncExpressNeedleBlockVisibility(document, gaugeOk());
    updateSummaries();
    updateGeneratePatternAvailability();
    const secG = stepSection(STEPS);
    if (secG) secG.classList.toggle("express-acc--complete", gaugeStepOk());
    updatePills();
    if (persist) persistExpressSession();
  }

  function onGaugeInput() {
    persistExpressSession();
    syncExpressWizardToPatternStorage(values, null);
    refreshGaugeStepUi(false);
  }

  function onNeedlesInput() {
    persistExpressSession();
    syncExpressWizardToPatternStorage(values, null);
    refreshGaugeStepUi(false);
    clearAvailableNeedlesFieldErrorIfValid(getAvailableNeedlesInputById());
  }

  function applyExpressBuilderUiReset(): void {
    for (const k of Object.keys(values)) {
      delete values[k];
    }
    ensureExpressStyleDefaults(values);
    openStep = 1;
    maxReachable = 1;

    const scope = document.querySelector("[data-express-builder]");
    if (scope) {
      scope.querySelectorAll("input, select, textarea").forEach((el) => {
        if (el instanceof HTMLInputElement) {
          if (el.type === "radio" || el.type === "checkbox") {
            el.checked = el.defaultChecked;
          } else {
            el.value = el.defaultValue ?? "";
          }
        } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
          el.value = el.defaultValue ?? "";
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });

      scope
        .querySelectorAll(
          ".express-option--selected, .express-style-card--selected, .is-selected, .selected",
        )
        .forEach((el) => {
          el.classList.remove(
            "express-option--selected",
            "express-style-card--selected",
            "is-selected",
            "selected",
          );
        });

      scope.querySelectorAll("[aria-pressed]").forEach((el) => {
        el.setAttribute("aria-pressed", "false");
      });
    }

    clearAllLockedFeedback();
    updatePills();
    updateSections();

    try {
      localStorage.removeItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    document.getElementById("express-pattern-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    hideExpressEditingBar();
    syncSleevelessBuilderHeaderTitle();
  }

  let expressStartOverBusy = false;

  function requestResetExpressBuilder(): void {
    if (expressStartOverBusy) return;
    expressStartOverBusy = true;
    void startNewCustomPatternFromExpress(applyExpressBuilderUiReset).finally(() => {
      expressStartOverBusy = false;
    });
  }

  function hideExpressEditingBar(): void {
    const bar = document.querySelector("[data-express-editing-bar]");
    if (bar instanceof HTMLElement) bar.hidden = true;
    const toolbar = document.querySelector(".express-builder-toolbar");
    if (toolbar instanceof HTMLElement) toolbar.hidden = false;
  }

  function showExpressEditingBar(): void {
    const bar = document.querySelector("[data-express-editing-bar]");
    if (!(bar instanceof HTMLElement)) return;

    const nameEl = bar.querySelector("[data-express-editing-name]");
    if (nameEl) nameEl.textContent = getExpressEditingProjectLabel();

    bar.hidden = false;
    const toolbar = document.querySelector(".express-builder-toolbar");
    if (toolbar instanceof HTMLElement) toolbar.hidden = true;
  }

  function initExpressEditingBar(): void {
    if (isEditingSavedCustomPatternProject()) {
      hideExpressEditingBar();
      return;
    }

    if (
      startedFreshSession ||
      editChoicesReopen ||
      !persisted ||
      !hasExpressResumeProgress(values)
    ) {
      hideExpressEditingBar();
      return;
    }

    showExpressEditingBar();

    document.querySelector("[data-express-editing-start-new]")?.addEventListener("click", () => {
      requestResetExpressBuilder();
    });
  }

  const root = document.getElementById("express-accordions");
  if (root) {
    root.addEventListener("click", onChoiceClick);
    root.addEventListener("click", onExpressSizeRowActivate);
    root.addEventListener("keydown", onExpressSizeRowActivate);
    root.addEventListener("change", onExpressSizeSelectChange);
  }

  document.querySelectorAll("[data-express-header]").forEach((h) => {
    h.addEventListener("click", onHeaderActivate);
    h.addEventListener("keydown", onHeaderKey);
  });

  document.querySelectorAll("[data-express-chevron]").forEach((c) => {
    c.addEventListener("click", onChevronClick);
  });

  pills.forEach((p) => p.addEventListener("click", onPillClick));

  document.getElementById("express-start-over-btn")?.addEventListener("click", requestResetExpressBuilder);

  document.getElementById("express-customize-pattern")?.addEventListener("click", () => {
    void (async () => {
      try {
        await loadExpressSweaterCharts();
      } catch {
        window.alert("Could not load size charts. Check your connection and try again.");
        return;
      }
      const aud = expressWhoToChartAudience(values.who);
      const sm = mapExpressStyle(values.style ?? "");
      const chartFit = nonEmptyTrimmed(values.selectedSize)
        ? resolveExpressChartFit(aud, values.selectedSize!.trim(), values.fit || "standard", {
            bodyShape: sm.bodyShape,
          })
        : null;
      syncExpressWizardToPatternStorage(values, chartFit);
      window.location.assign("/patterns/sleeveless-custom");
    })();
  });

  const stitchesInput = document.getElementById(GAUGE_STITCH_ID);
  const rowsInput = document.getElementById(GAUGE_ROW_ID);
  const needlesInput = getAvailableNeedlesInputById();

  bindAvailableNeedlesFieldValidation(needlesInput);

  stitchesInput?.addEventListener("input", onGaugeInput);
  stitchesInput?.addEventListener("change", onGaugeInput);
  rowsInput?.addEventListener("input", onGaugeInput);
  rowsInput?.addEventListener("change", onGaugeInput);
  needlesInput?.addEventListener("input", onNeedlesInput);
  needlesInput?.addEventListener("change", onNeedlesInput);

  wireExpressBuilderReviewSubmit({
    openGaugeStepForValidation,
    onProceed: () => {
      const stEl = document.getElementById(GAUGE_STITCH_ID);
      const rwEl = document.getElementById(GAUGE_ROW_ID);
      if (!(stEl instanceof HTMLInputElement) || !(rwEl instanceof HTMLInputElement)) return;

      if (
        !values.who ||
        !nonEmptyTrimmed(values.selectedSize) ||
        !nonEmptyTrimmed(values.front) ||
        !values.neckline ||
        !values.fit
      ) {
        window.alert("Please complete all Express steps before generating your pattern.");
        return;
      }

      const unit = getExpressGaugeUnit();
      const gaugeStitchRaw = stEl.value.trim();
      const gaugeRowRaw = rwEl.value.trim();
      rawSwatchToPerInch(gaugeStitchRaw, gaugeRowRaw, unit);

      const aud = expressWhoToChartAudience(values.who);
      const fitPref = values.fit;

      void (async () => {
        try {
          await loadExpressSweaterCharts();
        } catch {
          window.alert("Could not load size charts. Check your connection and try again.");
          return;
        }
        const sm = mapExpressStyle(values.style ?? "");
        const chartFit = resolveExpressChartFit(aud, values.selectedSize!.trim(), fitPref, {
          bodyShape: sm.bodyShape,
        });
        if (!chartFit) {
          window.alert("Please choose a valid size for this wearer.");
          return;
        }
        persistExpressSession();
        persistExpressBuilderState(values, chartFit);
        persistExpressSession();

        const baseWorkspaceHref =
          document
            .querySelector<HTMLElement>("[data-express-review-href]")
            ?.getAttribute("data-express-review-href")
            ?.trim() || "/patterns/sleeveless/pattern/?generated=1";
        const access = await resolveSleevelessUserAccess();
        const workspaceHref = resolveExpressBuilderPostBuildHref(
          baseWorkspaceHref,
          access.hasSystemAccess,
        );
        window.location.href = workspaceHref;
      })();
    },
  });

  /** Keep the Fit-card ease copy (`Approx. +3" ease`) in the active measurement unit. */
  function refreshFitEaseLabels(): void {
    applyFitEaseUnitLabels(document, getExpressUiUnit());
  }

  window.addEventListener("kbm:units-change", (ev: Event) => {
    const tid = (ev as CustomEvent<{ toggleId?: string }>).detail?.toggleId;
    if (tid != null && tid !== SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID) return;
    refreshExpressWhoSizePanel();
    refreshFitEaseLabels();
    onGaugeInput();
  });

  // Reflect the persisted/default unit into the Fit cards on first paint (they render in inches).
  refreshFitEaseLabels();

  void loadExpressSweaterCharts()
    .then(() => {
      const st = document.querySelector("[data-express-size-status]");
      if (st instanceof HTMLElement) st.setAttribute("hidden", "");
      refreshExpressWhoSizePanel();
      refreshBuilderState();
    })
    .catch(() => {
      const st = document.querySelector("[data-express-size-status]");
      if (st instanceof HTMLElement) {
        st.textContent = "Could not load size charts. Check your connection and refresh.";
        st.style.color = "#b91c1c";
        st.removeAttribute("hidden");
      }
    });

  if (
    nonEmptyTrimmed(values.front) &&
    (!isEditingSavedCustomPatternProject() || editChoicesReopen)
  ) {
    writeSleevelessGarmentTypeLocalStorage(garmentTypeFromFront(values.front));
    syncExpressWizardToPatternStorage(values, null);
  }

  refreshBuilderState();
  applyExpressGaugeSectionHash();
  syncSleevelessBuilderHeaderTitle();
  initExpressEditingBar();
  syncExpressChartAudienceLockUi();

  document.addEventListener(CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT, syncExpressChartAudienceLockUi);
}

function initExpressTopTabs(): void {
  const root = document.querySelector(".sleeveless-express-page .pattern-tabs");
  if (!root) return;
  initPatternTabs(root);

  try {
    const u = new URL(window.location.href);
    if (u.searchParams.get("tab") === "pattern") {
      u.searchParams.delete("tab");
      const qs = u.searchParams.toString();
      window.history.replaceState({}, "", `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * `?new=1` is the "Start a New Pattern" deep link (Patterns landing, in-page Start Over navigation).
 * A logged-in free user who already claimed their one-time free pattern must be blocked here —
 * before {@link applySleevelessExpressNewSessionFromUrl} clears any draft and before the setup
 * questions / title / notes are shown. Logged-out visitors are handled by the member gate, and
 * members / free-unclaimed users proceed normally.
 */
async function handlePatternBuilderPurchaseReturnOnBoot(): Promise<void> {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return;
  }

  const purchaseReturn = await processPatternBuilderPurchaseReturn(url);
  const cleanedPath = stripPatternBuilderPurchaseReturnParams(url);
  window.history.replaceState({}, "", cleanedPath);

  if (purchaseReturn.kind === "success" && purchaseReturn.unlocked) {
    showPatternBuilderUnlockedConfirmation(
      document,
      purchaseReturn.title ?? "",
      purchaseReturn.message ?? "",
    );
    return;
  }

  if (purchaseReturn.errorMessage) {
    setPendingUpgradeCheckoutError(purchaseReturn.errorMessage, purchaseReturn.builderKey ?? undefined);
  }
}

async function blockExpressNewPatternStartIfLocked(): Promise<boolean> {
  let isNewSessionIntent = false;
  try {
    isNewSessionIntent = isSleevelessExpressNewSessionSearchParams(
      new URL(window.location.href).searchParams,
    );
  } catch {
    isNewSessionIntent = false;
  }
  if (!isNewSessionIntent) return false;

  const patternSystem = resolvePatternSystemForBuilderGate(document);
  const access = await resolveSleevelessUserAccess();
  const canStartNew = canStartNewPatternForSystem(access, patternSystem);
  logPatternEditGateDebug("blockExpressNewPatternStartIfLocked", {
    patternSystem,
    hasSystemAccess: access.hasSystemAccess,
    freeClaimsBySystem: access.freeClaimsBySystem,
    extra: { canStartNew, isNewSessionIntent },
  });
  if (!access.loggedIn || canStartNew) return false;

  // `?new=1` means "start a new pattern". When creation is locked we still return early (skipping
  // initExpressPage → applySleevelessExpressNewSessionFromUrl), so exit any leftover saved-pattern
  // edit session here — otherwise the "Editing saved pattern" wrapper (Save Changes / Save a Copy /
  // X) from customPatternEditingBanner.ts would frame the unlock gate for a claimed free user.
  exitEditingSavedCustomPattern();
  showSleevelessNewPatternLockedScreen(
    document,
    resolveNewPatternBlockedCopy(access, patternSystem, document),
    patternSystem,
    access,
  );
  return true;
}

/**
 * Editing a SAVED pattern (`?edit=choices`, or any session with an active saved-project id) opens
 * the Express builder with every step unlocked and prefilled. A logged-in user who lacks settings-
 * editing access (free user who already claimed their one pattern, or a downgraded member) must not
 * land on that editable surface — their pattern is view-only. Send them to the read-only pattern
 * view instead. This mirrors the workspace Edit Pattern gate and also protects direct-URL access.
 */
async function redirectSavedPatternEditIfLocked(): Promise<boolean> {
  let isNewSessionIntent = false;
  let isEditChoicesIntent = false;
  try {
    const params = new URL(window.location.href).searchParams;
    isNewSessionIntent = isSleevelessExpressNewSessionSearchParams(params);
    isEditChoicesIntent = isSleevelessExpressEditChoicesSearchParams(params);
  } catch {
    isNewSessionIntent = false;
    isEditChoicesIntent = false;
  }
  // ?new=1 always means a fresh builder session — never redirect to a saved pattern view.
  if (isNewSessionIntent) return false;
  if (!isEditChoicesIntent && !isEditingSavedCustomPatternProject()) return false;

  const access = await resolveSleevelessUserAccess();
  const patternSystem = resolvePatternSystemForEntitlement(document);
  logPatternEditGateDebug("redirectSavedPatternEditIfLocked", {
    patternSystem,
    hasSystemAccess: access.hasSystemAccess,
    freeClaimsBySystem: access.freeClaimsBySystem,
    extra: {
      canEdit: canEditPatternSettingsForSystem(access, patternSystem),
      isEditChoicesIntent,
    },
  });
  if (!access.loggedIn || canEditPatternSettingsForSystem(access, patternSystem)) return false;

  // `replace` so the browser back button does not bounce them onto the editable URL again.
  window.location.replace(OPEN_PATTERN_HREF);
  return true;
}

if (typeof document !== "undefined") {
  const boot = (): void => {
    void (async () => {
      // Reconcile draft ownership against the authenticated member BEFORE any hydration so a
      // different member never inherits the previous member's local working draft. Runs first;
      // `?new=1` in initExpressPage clears again for the explicit "start new" path.
      await reconcilePatternDraftOwner();
      await handlePatternBuilderPurchaseReturnOnBoot();
      const blocked = await blockExpressNewPatternStartIfLocked();
      if (blocked) return;
      const redirected = await redirectSavedPatternEditIfLocked();
      if (redirected) return;
      initExpressPage();
      initExpressTopTabs();
    })();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
