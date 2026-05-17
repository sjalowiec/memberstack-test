/**
 * Custom Build — Design step (/patterns/sleeveless/custom-build/design).
 * Accordion + persistence aligned with Quick Build; merges into {@link SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY}.
 */
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, getPatternData } from "../lib/patterns/patternStorage";
import {
  loadExpressSweaterCharts,
  expressWhoToChartAudience,
  formatExpressSelectedSizeSummary,
  nonEmptyTrimmed,
  refreshExpressSizePanel,
  patchExpressSizeBodyConfirmation,
  isValidExpressSizeForAudience,
  SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
import { scrollToBuilderSection } from "../lib/patterns/scrollToBuilderSection";
import { resolveSleevelessAudienceHeroImageSrc } from "../lib/patterns/sleevelessAudienceHeroImage";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";

const STEPS = 2;
const LOCKED_STEP_NAV_TITLE = "Finish the previous step to continue.";

const LABELS: Record<string, Record<string, string>> = {
  who: { women: "Women", men: "Men", kids: "Kids", baby: "Baby" },
};

function ensureExpressStyleDefaults(v: Record<string, string>): void {
  v.shape = "straight";
  v.front = "closed";
  v.style = "straight-pullover";
}

interface ExpressPersistedV1 {
  values?: Record<string, string>;
  openStep?: number;
  maxReachable?: number;
  flowSteps?: number;
  gaugeStitchRaw?: string;
  gaugeRowRaw?: string;
  cbDesignOpenStep?: number;
  cbDesignMaxReachable?: number;
}

function loadExpressPersisted(): ExpressPersistedV1 | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as ExpressPersistedV1;
  } catch {
    return null;
  }
}

function persistDesignBuilderState(
  values: Record<string, string>,
  openStep: number,
  maxReachable: number,
): void {
  if (typeof localStorage === "undefined") return;
  const prev = loadExpressPersisted() ?? {};
  try {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        ...prev,
        values: { ...values },
        cbDesignOpenStep: openStep,
        cbDesignMaxReachable: maxReachable,
      }),
    );
  } catch {
    /* quota */
  }
}

function maxReachableFromChoices(v: Record<string, string>): number {
  if (v.who && nonEmptyTrimmed(v.selectedSize)) return 2;
  if (v.who) return 2;
  return 1;
}

function designBasicsComplete(v: Record<string, string>): boolean {
  return !!(v.who && nonEmptyTrimmed(v.selectedSize));
}

function stepSection(step: number): HTMLElement | null {
  return document.querySelector(`[data-cb-design-root] [data-express-step="${step}"]`);
}

function initCustomBuildDesignPage(): void {
  const root = document.querySelector("[data-cb-design-root]");
  if (!(root instanceof HTMLElement)) return;

  const persisted = loadExpressPersisted();
  const values: Record<string, string> =
    persisted?.values && typeof persisted.values === "object" && !Array.isArray(persisted.values)
      ? { ...persisted.values }
      : {};
  ensureExpressStyleDefaults(values);

  let openStep =
    typeof persisted?.cbDesignOpenStep === "number" && Number.isFinite(persisted.cbDesignOpenStep)
      ? Math.floor(persisted.cbDesignOpenStep)
      : 1;
  if (openStep < 1) openStep = 1;
  let maxReachable = maxReachableFromChoices(values);
  openStep = Math.min(maxReachable, Math.max(1, openStep));

  const sections = root.querySelectorAll("[data-express-step]");
  const flowPills = document.querySelectorAll("[data-cb-flow-pill]");

  /**
   * Who + Size cluster (matches Quick Build / sleeveless-express): both sections stay expanded while
   * `openStep` is 1 or 2 (and not 0). Collapsing to step 0 hides the cluster behavior for size.
   */
  function keepWhoSizeClusterExpanded(): boolean {
    if (!values.who) return false;
    if (openStep === 0 || openStep > STEPS) return false;
    return true;
  }

  function canInteractWithSizeStep(): boolean {
    return keepWhoSizeClusterExpanded();
  }

  function isSectionBodyOpen(step: number): boolean {
    if (step === openStep) return true;
    if (keepWhoSizeClusterExpanded() && (step === 1 || step === 2)) return true;
    return false;
  }

  function summaryText(field: string): string {
    if (field === "selectedSize") {
      return formatExpressSelectedSizeSummary(values);
    }
    const v = values[field];
    if (!v) return "";
    const map = LABELS[field];
    return map && map[v] ? map[v] : v;
  }

  function isStepComplete(step: number): boolean {
    if (step === 1) return !!values.who;
    if (step === 2) return nonEmptyTrimmed(values.selectedSize);
    return false;
  }

  function clearAllLockedFeedback() {
    root.querySelectorAll("[data-express-locked-feedback]").forEach((el) => {
      el.setAttribute("hidden", "");
    });
  }

  function showLockedFeedback(sectionEl: HTMLElement | null) {
    clearAllLockedFeedback();
    const fb = sectionEl?.querySelector("[data-express-locked-feedback]");
    if (fb) fb.removeAttribute("hidden");
  }

  function updateSizeBodyConfirmation(): void {
    patchExpressSizeBodyConfirmation(root, values);
  }

  function updateSummaries() {
    root.querySelectorAll("[data-express-summary]").forEach((el) => {
      const key = el.getAttribute("data-express-summary");
      if (!key) return;
      el.textContent = summaryText(key);
    });
    updateSizeBodyConfirmation();
  }

  function syncPatternIfPossible(): void {
    syncCustomBuildToPatternStorage();
  }

  function updateFlowPills() {
    flowPills.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const step = parseInt(btn.getAttribute("data-cb-flow-pill") ?? "0", 10);
      const label = btn.getAttribute("data-cb-flow-label") || `Step ${step}`;
      const item = btn.closest(".sg-builder-nav__item");

      if (step <= STEPS) {
        const complete = isStepComplete(step);
        const isCurrent = step === openStep;
        const locked = step > maxReachable;

        btn.classList.toggle("is-complete", complete);
        btn.classList.toggle("is-current", isCurrent);
        btn.classList.toggle("is-upcoming", locked);

        if (locked) {
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
        else if (locked) btn.setAttribute("aria-label", `${label}, locked`);
        else btn.setAttribute("aria-label", label);
      } else {
        btn.classList.remove("is-complete", "is-current");
        btn.classList.add("is-upcoming");
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("title", "Use Continue to move through the Custom Build steps.");
        btn.removeAttribute("aria-current");
        if (item) item.classList.remove("active");
        btn.setAttribute("aria-label", label);
      }
    });
  }

  function setBodyHidden(sectionEl: HTMLElement, hide: boolean) {
    const body = sectionEl.querySelector(".express-acc__body");
    if (!body) return;
    if (hide) body.setAttribute("hidden", "");
    else body.removeAttribute("hidden");
  }

  function refreshSizePanel(): void {
    refreshExpressSizePanel(root, values, canInteractWithSizeStep());
  }

  function refreshCbDesignWhoCardImages(): void {
    const patternData = getPatternData();
    root.querySelectorAll('[data-choice][data-field="who"]').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const whoPick = btn.getAttribute("data-value");
      const img = btn.querySelector("img");
      if (!(img instanceof HTMLImageElement) || !whoPick) return;
      const aud = expressWhoToChartAudience(whoPick);
      img.src = resolveSleevelessAudienceHeroImageSrc(patternData, aud);
    });
  }

  function updateSections() {
    sections.forEach((el) => {
      const sectionEl = el as HTMLElement;
      const step = parseInt(sectionEl.getAttribute("data-express-step") ?? "0", 10);
      const open = isSectionBodyOpen(step);
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
    });

    updateSummaries();
    updateFlowPills();
    updateContinueLink();
    applySelectionUI();
    refreshSizePanel();
    refreshCbDesignWhoCardImages();
  }

  function updateContinueLink() {
    const a = document.querySelector("[data-cb-continue-link]");
    if (!(a instanceof HTMLAnchorElement)) return;
    const ok = designBasicsComplete(values);
    if (ok) {
      a.removeAttribute("aria-disabled");
      a.removeAttribute("tabindex");
      a.setAttribute("aria-label", "Continue to Style and Shaping");
    } else {
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("tabindex", "-1");
      a.setAttribute("aria-label", "Complete all design sections to continue");
    }
  }

  function refreshBuilderState(persist = true): void {
    maxReachable = maxReachableFromChoices(values);
    if (openStep > maxReachable) openStep = maxReachable;
    updateSections();
    if (persist) persistDesignBuilderState(values, openStep, maxReachable);
    syncPatternIfPossible();
  }

  function goToStep(step: number) {
    if (step < 1 || step > STEPS) return;
    if (step > maxReachable) return;
    clearAllLockedFeedback();
    openStep = step;
    refreshBuilderState();
  }

  flowPills.forEach((pill) => {
    if (!(pill instanceof HTMLElement)) return;
    pill.addEventListener("click", () => {
      const step = parseInt(pill.getAttribute("data-cb-flow-pill") ?? "0", 10);
      if (step < 1 || step > STEPS) return;
      if (pill.getAttribute("aria-disabled") === "true") return;
      goToStep(step);
      scrollToBuilderSection(stepSection(step));
    });
  });

  function markChoiceSelected(sectionEl: HTMLElement, selectedEl: HTMLElement) {
    const scope =
      selectedEl.closest(".hat-length-picker__grid") ??
      selectedEl.closest(".express-options--who") ??
      sectionEl;
    scope.querySelectorAll(".hat-length-picker__option").forEach((el) => {
      el.classList.remove("is-selected");
      if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", "false");
    });
    if (selectedEl.classList.contains("hat-length-picker__option")) {
      selectedEl.classList.add("is-selected");
      selectedEl.setAttribute("aria-pressed", "true");
    }
  }

  function applySelectionUI() {
    const pairs: { step: number; field: keyof typeof LABELS; sel: string }[] = [
      { step: 1, field: "who", sel: ".express-options--who" },
    ];
    pairs.forEach(({ step, field, sel }) => {
      const sec = stepSection(step);
      if (!sec || !values[field]) return;
      const c = sec.querySelector(sel);
      if (!c || !(c instanceof HTMLElement)) return;
      const hit = c.querySelector(`[data-choice][data-value="${values[field]}"]`);
      if (hit instanceof HTMLElement) markChoiceSelected(sec, hit);
    });
  }

  function selectExpressSize(sizeValue: string): void {
    const trimmed = String(sizeValue).trim();
    if (!trimmed) return;
    if (!canInteractWithSizeStep()) return;
    const aud = expressWhoToChartAudience(values.who);
    if (!isValidExpressSizeForAudience(aud, trimmed)) return;

    values.selectedSize = trimmed;
    clearAllLockedFeedback();
    refreshBuilderState();
  }

  function clearSelectedSize(): void {
    if (!nonEmptyTrimmed(values.selectedSize)) return;
    delete values.selectedSize;
    clearAllLockedFeedback();
    refreshBuilderState();
  }

  function onChoiceClick(ev: Event) {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest("[data-choice]");
    if (!btn) return;
    const sec = btn.closest("[data-express-step]");
    if (!(sec instanceof HTMLElement)) return;
    if (!root.contains(sec)) return;
    const stepNum = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (stepNum !== openStep && !(keepWhoSizeClusterExpanded() && stepNum === 1)) return;

    const field = btn.getAttribute("data-field");
    const value = btn.getAttribute("data-value");
    if (!field || value == null) return;

    if (field === "who") {
      const prevWho = values.who;
      if (prevWho !== undefined && prevWho !== value) {
        delete values.selectedSize;
      }
    }

    values[field] = value;
    ensureExpressStyleDefaults(values);
    markChoiceSelected(sec, btn as HTMLElement);

    if (field === "who") {
      refreshSizePanel();
    }

    clearAllLockedFeedback();
    refreshBuilderState();

    if (field === "who") {
      goToStep(2);
    }
  }

  function onExpressSizeSelectChange(ev: Event): void {
    const t = ev.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (!t.hasAttribute("data-express-size-select")) return;
    if (!root.contains(t)) return;
    if (!canInteractWithSizeStep()) return;
    const v = t.value.trim();
    if (!v) {
      clearSelectedSize();
      return;
    }
    selectExpressSize(v);
  }

  function onExpressSizeRowActivate(ev: Event) {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("[data-express-size-row]");
    if (!(row instanceof HTMLTableRowElement)) return;
    if (!root.contains(row)) return;

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
    if (!root.contains(sec)) return;
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
    if (!root.contains(sec)) return;
    const step = parseInt(sec.getAttribute("data-express-step") ?? "0", 10);
    if (step > maxReachable) return;
    const header = sec.querySelector("[data-express-header]");
    if (header instanceof HTMLElement) onHeaderActivate({ currentTarget: header } as unknown as Event);
  }

  function resetDesign(): void {
    if (!confirm("Start over and clear your sizing selections on this page?")) return;
    delete values.who;
    delete values.selectedSize;
    ensureExpressStyleDefaults(values);
    openStep = 1;
    maxReachable = 1;
    clearAllLockedFeedback();
    refreshBuilderState();
    document.getElementById("cb-design-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  root.addEventListener("click", onChoiceClick);
  root.addEventListener("click", onExpressSizeRowActivate);
  root.addEventListener("keydown", onExpressSizeRowActivate);
  root.addEventListener("change", onExpressSizeSelectChange);

  root.querySelectorAll("[data-express-header]").forEach((h) => {
    h.addEventListener("click", onHeaderActivate);
    h.addEventListener("keydown", onHeaderKey);
  });

  root.querySelectorAll("[data-express-chevron]").forEach((c) => {
    c.addEventListener("click", onChevronClick);
  });

  document.getElementById("cb-design-start-over-btn")?.addEventListener("click", resetDesign);

  document.querySelector("[data-cb-continue-link]")?.addEventListener("click", (e) => {
    const a = e.currentTarget;
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!designBasicsComplete(values)) {
      e.preventDefault();
    }
  });

  window.addEventListener("kbm:units-change", (ev: Event) => {
    const tid = (ev as CustomEvent<{ toggleId?: string }>).detail?.toggleId;
    if (tid != null && tid !== SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID) return;
    refreshSizePanel();
    updateSummaries();
  });

  void loadExpressSweaterCharts()
    .then(() => {
      const st = root.querySelector("[data-express-size-status]");
      if (st instanceof HTMLElement) st.setAttribute("hidden", "");
      refreshBuilderState(true);
    })
    .catch(() => {
      const st = root.querySelector("[data-express-size-status]");
      if (st instanceof HTMLElement) {
        st.textContent = "Could not load size charts. Check your connection and refresh.";
        st.style.color = "#b91c1c";
        st.removeAttribute("hidden");
      }
      refreshBuilderState(true);
    });
}

if (typeof document !== "undefined") {
  const boot = (): void => {
    initCustomBuildDesignPage();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
