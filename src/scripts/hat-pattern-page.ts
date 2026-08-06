/**
 * Hat pattern workspace — reading layout + Edit Pattern drawer + print.
 * Matches sleeveless/drop-shoulder workspace conventions without membership gate.
 */

import hatSizingRows from "../data/sizing_hats.json";
import {
  ensureHatDraftMigrated,
  readHatDraft,
  syncHatDraftFromBuilderFields,
  writeHatDraftAndLegacyMirrors,
  type HatDraft,
  type HatDraftUnit,
} from "../lib/patterns/hat/hatDraft";
import {
  buildHatBuilderMissingDraftHref,
  HAT_BUILDER_HREF,
  HAT_EDIT_CHOICES_HREF,
  HAT_NEW_PATTERN_HREF,
  PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY,
} from "../lib/patterns/hat/hatNavigation";
import {
  calculateHatPatternFromDraft,
  isHatDraftReadyForPattern,
  type HatSizingChartRow,
} from "../lib/patterns/hat/hatPatternFromDraft";
import { buildHatAtAGlanceHtml } from "../lib/patterns/hat/hatPatternSummary";
import { buildHatPatternHtml } from "../lib/patterns/hat/hatInstructions";
import { loadHatDiagramSvg } from "../lib/patterns/hat/hatDiagram";
import { roundFinishedHatSizeFromHead } from "../lib/patterns/hat/hatMath";
import {
  bindPatternTipDismiss,
  patternTipsControlBoxHtml,
  refreshPatternTipDismiss,
  updateTipsResetLinkVisibility,
} from "../lib/patterns/patternTipDismiss";
import { triggerPatternPrint } from "./patternPrintPersonalization";

type WizardUtils = {
  convertLength: (v: number, from: string, to: string) => number;
  formatLength: (v: number, unit: string) => string;
  formatLengthWithUnit: (v: number, unit: string) => string;
};

const HAT_TIPS_KEY = "hat-show-tips";

function wu(): WizardUtils {
  return (window as unknown as { WizardUtils: WizardUtils }).WizardUtils;
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const sizingRows: HatSizingChartRow[] = (hatSizingRows as HatSizingChartRow[]).map((row) => ({
  ...row,
  finishedSizeInches: roundFinishedHatSizeFromHead(Number(row.circumference)),
}));

function applyHatPatternSectionCollapseState(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll(".hat-pattern-section").forEach((section) => {
    const id = (section as HTMLElement).dataset.sectionId;
    if (!id) return;
    const checkbox = section.querySelector(
      ":scope > .hat-pattern-section__header input.hat-pattern-section__collapse",
    );
    if (!(checkbox instanceof HTMLInputElement)) return;
    const collapsed = localStorage.getItem(`hatPattern_section_${id}`) === "true";
    checkbox.checked = collapsed;
    section.classList.toggle("is-collapsed", collapsed);
  });
}

function bindCollapsePersistence(root: HTMLElement | null): void {
  if (!root || root.dataset.collapseBound === "true") return;
  root.dataset.collapseBound = "true";
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("hat-pattern-section__collapse")) {
      return;
    }
    const id = t.getAttribute("data-section-id");
    if (!id) return;
    localStorage.setItem(`hatPattern_section_${id}`, t.checked ? "true" : "false");
    t.closest(".hat-pattern-section")?.classList.toggle("is-collapsed", t.checked);
  });
}

function initTips(scope: HTMLElement | null): void {
  if (!(scope instanceof HTMLElement)) return;
  bindPatternTipDismiss(scope, HAT_TIPS_KEY, null);
  refreshPatternTipDismiss(scope, HAT_TIPS_KEY);
  updateTipsResetLinkVisibility(scope, HAT_TIPS_KEY);
}

async function renderPattern(draft: HatDraft): Promise<boolean> {
  const { convertLength, formatLength, formatLengthWithUnit } = wu();
  const calc = calculateHatPatternFromDraft(draft, sizingRows, (cm) =>
    convertLength(cm, "cm", "inches"),
  );
  if (!calc) return false;

  const showTips = localStorage.getItem(HAT_TIPS_KEY) === "true";
  const tipsIntroHtml = patternTipsControlBoxHtml(showTips);
  const patternHTML = buildHatPatternHtml({
    calc,
    currentUnit: draft.unit,
    scrapOffPatternTooltip:
      document.querySelector<HTMLElement>("[data-hat-scrap-off-tooltip]")?.dataset
        .hatScrapOffTooltip || "Scrap Off",
    tipsIntroHtml,
    showTips,
    formatters: { convertLength, formatLength },
  });

  const mount = document.querySelector<HTMLElement>("[data-hat-pattern-mount]");
  const patternContent = el<HTMLElement>("pattern-content");
  if (mount) mount.innerHTML = patternHTML;
  if (patternContent) {
    patternContent.dataset.showTips = showTips ? "true" : "false";
    applyHatPatternSectionCollapseState(patternContent);
    bindCollapsePersistence(patternContent);
  }

  const glance = document.querySelector<HTMLElement>("[data-hat-print-basics-body]");
  if (glance) {
    glance.innerHTML = buildHatAtAGlanceHtml({
      draft,
      calc,
      sizingRows,
      formatLength,
      convertLength,
    });
  }

  const intro = document.querySelector<HTMLElement>("[data-hat-pattern-intro]");
  if (intro) {
    intro.innerHTML = `<p>Finished circumference ${formatLengthWithUnit(
      draft.unit === "inches"
        ? calc.targetWidth
        : convertLength(calc.targetWidth, "inches", "cm"),
      draft.unit,
    )} · Cast on ${calc.castOnSts} stitches (crown may adjust).</p>`;
  }

  const diagramHost = document.querySelector<HTMLElement>("[data-hat-diagram-mount]");
  if (diagramHost) {
    diagramHost.innerHTML = await loadHatDiagramSvg(calc, draft.unit, {
      convertLength,
      formatLengthWithUnit,
    });
  }

  const zeroBody = el<HTMLElement>("hat-zero-body-warning");
  if (zeroBody) {
    if (calc.bodyRows <= 0) zeroBody.removeAttribute("hidden");
    else zeroBody.setAttribute("hidden", "");
  }

  const results = el<HTMLElement>("hat-pattern-results");
  if (results) results.style.display = "block";

  window.dispatchEvent(new CustomEvent("kbm:hat-pattern-rendered"));
  initTips(el<HTMLElement>("hat-pattern-tips-scope"));
  return true;
}

function openEditDrawer(open: boolean): void {
  const drawer = document.querySelector<HTMLElement>("[data-hat-edit-drawer]");
  if (!drawer) return;
  drawer.classList.toggle("is-open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("hat-edit-drawer-open", open);
}

function fillEditForm(draft: HatDraft): void {
  const setVal = (id: string, v: string) => {
    const node = el<HTMLInputElement | HTMLSelectElement>(id);
    if (node) node.value = v;
  };
  setVal("hat-edit-unit", draft.unit);
  setVal("hat-edit-size", draft.sizeSel);
  setVal("hat-edit-custom-circ", draft.customCircumference);
  setVal("hat-edit-fit", draft.fit);
  setVal("hat-edit-custom-length", draft.customHatLength);
  setVal("hat-edit-brim-type", draft.brimType);
  setVal("hat-edit-brim-length", draft.brimLength);
  setVal("hat-edit-crown", draft.crownShaping);
  const slot = draft.gaugeSlots[draft.unit];
  setVal("hat-edit-stitch-gauge", slot.stitch);
  setVal("hat-edit-row-gauge", slot.row);

  const customSize = el<HTMLElement>("hat-edit-custom-size-wrap");
  if (customSize) customSize.hidden = draft.sizeSel !== "custom";
  const customLen = el<HTMLElement>("hat-edit-custom-length-wrap");
  if (customLen) customLen.hidden = draft.fit !== "custom";
}

function readEditForm(): HatDraft | null {
  const prev = readHatDraft();
  if (!prev) return null;
  const unit = (el<HTMLSelectElement>("hat-edit-unit")?.value === "cm" ? "cm" : "inches") as HatDraftUnit;
  const sizeSel = el<HTMLSelectElement>("hat-edit-size")?.value ?? "";
  const fit = el<HTMLSelectElement>("hat-edit-fit")?.value ?? "";
  const gaugeSlots = {
    inches: { ...prev.gaugeSlots.inches },
    cm: { ...prev.gaugeSlots.cm },
  };
  gaugeSlots[unit] = {
    stitch: el<HTMLInputElement>("hat-edit-stitch-gauge")?.value ?? "",
    row: el<HTMLInputElement>("hat-edit-row-gauge")?.value ?? "",
  };
  return syncHatDraftFromBuilderFields({
    unit,
    sizeSel,
    customCircumference: el<HTMLInputElement>("hat-edit-custom-circ")?.value ?? "",
    brimType: el<HTMLSelectElement>("hat-edit-brim-type")?.value ?? "",
    brimLength: el<HTMLInputElement>("hat-edit-brim-length")?.value ?? "",
    crownShaping: el<HTMLSelectElement>("hat-edit-crown")?.value ?? "",
    fit,
    customHatLength: el<HTMLInputElement>("hat-edit-custom-length")?.value ?? "",
    gaugeSlots,
    showTips: localStorage.getItem(HAT_TIPS_KEY) === "true",
  });
}

function populateEditSizeOptions(): void {
  // Options are SSR-rendered in pattern/index.astro
}

async function boot(): Promise<void> {
  (window as unknown as { kbmPatternTipsControlBoxHtml: typeof patternTipsControlBoxHtml }).kbmPatternTipsControlBoxHtml =
    patternTipsControlBoxHtml;

  ensureHatDraftMigrated();
  let draft = readHatDraft();

  if (!isHatDraftReadyForPattern(draft)) {
    window.location.replace(buildHatBuilderMissingDraftHref());
    return;
  }

  populateEditSizeOptions();
  fillEditForm(draft!);
  writeHatDraftAndLegacyMirrors(draft!);

  const ok = await renderPattern(draft!);
  if (!ok) {
    window.location.replace(buildHatBuilderMissingDraftHref());
    return;
  }

  // Print button
  const actions = document.querySelector("[data-hat-pattern-actions]");
  if (actions instanceof HTMLElement && !actions.querySelector("#print-btn")) {
    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.id = "print-btn";
    printBtn.className = "sleeveless-pattern-print-action no-print";
    printBtn.setAttribute("data-testid", "button-print");
    printBtn.setAttribute("aria-label", "Print pattern");
    printBtn.innerHTML = `<i class="fas fa-print" aria-hidden="true"></i> Print`;
    printBtn.addEventListener("click", () => triggerPatternPrint(printBtn, {}));
    actions.appendChild(printBtn);
  }

  document.querySelector("[data-hat-edit-open]")?.addEventListener("click", () => {
    const d = readHatDraft();
    if (d) fillEditForm(d);
    openEditDrawer(true);
  });
  document.querySelectorAll("[data-hat-edit-close]").forEach((node) => {
    node.addEventListener("click", () => openEditDrawer(false));
  });
  document.querySelector("[data-hat-edit-apply]")?.addEventListener("click", async () => {
    const next = readEditForm();
    if (!next || !isHatDraftReadyForPattern(next)) {
      alert("Please complete all required fields before updating the pattern.");
      return;
    }
    writeHatDraftAndLegacyMirrors(next);
    await renderPattern(next);
    openEditDrawer(false);
  });
  document.querySelector("[data-hat-edit-builder]")?.addEventListener("click", () => {
    window.location.href = HAT_EDIT_CHOICES_HREF;
  });

  el<HTMLSelectElement>("hat-edit-size")?.addEventListener("change", () => {
    const wrap = el<HTMLElement>("hat-edit-custom-size-wrap");
    if (wrap) wrap.hidden = el<HTMLSelectElement>("hat-edit-size")?.value !== "custom";
  });
  el<HTMLSelectElement>("hat-edit-fit")?.addEventListener("change", () => {
    const wrap = el<HTMLElement>("hat-edit-custom-length-wrap");
    if (wrap) wrap.hidden = el<HTMLSelectElement>("hat-edit-fit")?.value !== "custom";
  });

  document
    .querySelector("[data-hat-new-pattern]")
    ?.addEventListener("click", () => {
      if (!confirm("Start a new hat? Your current choices will be cleared.")) return;
      window.location.href = HAT_NEW_PATTERN_HREF;
    });

  document
    .querySelector("[data-hat-back-builder]")
    ?.addEventListener("click", () => {
      window.location.href = HAT_EDIT_CHOICES_HREF;
    });

  // Tips toggle
  const tipsScope = el<HTMLElement>("hat-pattern-tips-scope");
  tipsScope?.addEventListener("click", (e) => {
    const toggleBtn = (e.target as HTMLElement)?.closest?.(".tips-inline-toggle");
    if (!(toggleBtn && tipsScope.contains(toggleBtn))) return;
    e.preventDefault();
    const isShowing = tipsScope.dataset.showTips === "true";
    const newState = !isShowing;
    tipsScope.dataset.showTips = newState ? "true" : "false";
    localStorage.setItem(HAT_TIPS_KEY, newState ? "true" : "false");
    const patternContent = el<HTMLElement>("pattern-content");
    if (patternContent) patternContent.dataset.showTips = newState ? "true" : "false";
    const slot = tipsScope.querySelector(".pattern-tips-intro-slot");
    if (slot) slot.innerHTML = patternTipsControlBoxHtml(newState);
    initTips(tipsScope);
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("edit") === "1") {
    openEditDrawer(true);
  }
  // Clean generated flag from URL without reload (optional)
  if (params.get(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY) === "1") {
    params.delete(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY);
    const qs = params.toString();
    history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  void HAT_BUILDER_HREF;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void boot();
  });
} else {
  void boot();
}
