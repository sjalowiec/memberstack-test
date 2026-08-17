/**
 * Finished Hat Pattern page — draft → calc → instructions + diagram.
 * Free / ungated. Edit Pattern navigates to `/patterns/hat/summary/` (no on-page drawer).
 */

import {
  convertLength,
  formatLength,
  formatLengthWithUnit,
} from "../components/wizards/utils/unitHelpers";
import { type ViewerAccessState } from "../lib/memberAccess";
import { buildHatSizingBuilderRows } from "../lib/patterns/hat/hatBuilderSizingLabels";
import { ensureHatDraftMigrated, readHatDraft } from "../lib/patterns/hat/hatDraft";
import { buildHatPatternDiagramSvg } from "../lib/patterns/hat/hatPatternDiagramSvg";
import { buildHatShapingNotationDiagramSvg } from "../lib/patterns/hat/hatShapingNotationDiagramSvg";
import {
  buildHatPatternDiagramTabsShellHtml,
  initHatPatternDiagramTabs,
} from "../lib/patterns/hat/hatPatternDiagramTabs";
import { buildHatPatternHtml } from "../lib/patterns/hat/hatInstructions";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import {
  buildHatPatternCalcFromDraft,
  buildHatPatternSummaryDlHtml,
  type HatSizingPatternRow,
} from "../lib/patterns/hat/hatPatternFromDraft";
import { dispatchHatYarnDimensions } from "../lib/patterns/hat/hatYarnEstimation";
import { bindHatPatternMyPatternsDisabledGuard } from "../lib/patterns/hat/hatPatternMyPatternsAccess";
import {
  applyHatPatternWorkspaceChrome,
  bindHatPatternWorkspaceAccessLifecycle,
} from "../lib/patterns/hat/hatPatternWorkspaceAccess";
import { initHatPatternNewPattern } from "../lib/patterns/hat/hatPatternNewPattern";
import { resolveHatPatternOnlineHeading, resolveHatPatternPrintFields } from "../lib/patterns/hat/hatPatternPrintTitle";
import {
  isEditingSavedHatProject,
  resolveHatPatternProjectNotes,
} from "../lib/patterns/hat/hatSavedProject";
import { applyPatternProjectOnlineNotes, HAT_PATTERN_ONLINE_NOTES_SELECTORS } from "../lib/patterns/patternProjectOnlineNotes";
import { getSleevelessPatternOnlineNotesText } from "../lib/patterns/sleevelessPatternProjectMeta";
import { ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { isHatPatternLeadRecognized } from "../lib/patterns/hat/hatPatternLeadHint";
import {
  bindHatLeadForm,
  revealHatLeadCapture,
  resolveHatPatternLeadContinue,
  setHatLeadCaptureVisible,
} from "../lib/patterns/hat/hatPatternLeadUi";
import { readHatPatternAccessSnapshot } from "../lib/patterns/hat/hatPatternWorkspaceAccess";
import {
  applyPatternPrintPersonalizationToDom,
  triggerPatternPrint,
} from "./patternPrintPersonalization.ts";
import hatSizingRows from "../data/sizing_hats.json";
import type { HatDisplayUnit, HatPatternCalc } from "../lib/patterns/hat/hatMath";

const HAT_ZERO_BODY_ROWS_WARNING =
  "Your current settings don't leave any room for the body of the hat. Try increasing the finished hat length, reducing the brim height, or choosing a shallower crown style.";

/** Last resolved viewer state so pattern re-renders cannot re-show the guest upsell. */
let lastHatPatternViewerAccessState: ViewerAccessState = "loggedOut";

function applyHatPatternMembershipChrome(state: ViewerAccessState): void {
  lastHatPatternViewerAccessState = state;
  applyHatPatternWorkspaceChrome(document, state, {
    isEditingSavedProject: isEditingSavedHatProject(),
  });
}

function scrapOffPatternTooltip(): string {
  const root = document.querySelector("[data-hat-pattern-page]");
  if (root instanceof HTMLElement) {
    const fromDom = root.dataset.scrapOffTooltip?.trim();
    if (fromDom) return fromDom;
  }
  return "Scrap Off";
}

function sizingRows(): HatSizingPatternRow[] {
  return buildHatSizingBuilderRows(
    Array.isArray(hatSizingRows) ? hatSizingRows : [],
  ) as HatSizingPatternRow[];
}

function applyHatPatternSectionCollapseState(root: HTMLElement | null) {
  if (!root) return;
  root.querySelectorAll(".hat-pattern-section").forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    const id = section.dataset.sectionId;
    if (!id) return;
    const header = section.querySelector(":scope > .hat-pattern-section__header");
    const checkbox = header?.querySelector("input.hat-pattern-section__collapse");
    if (!(checkbox instanceof HTMLInputElement)) return;
    const collapsed = localStorage.getItem(`hatPattern_section_${id}`) === "true";
    checkbox.checked = collapsed;
    section.classList.toggle("is-collapsed", collapsed);
  });
}

function bindHatPatternSectionCollapse(root: HTMLElement | null) {
  if (!root || root.dataset.hatSectionCollapseBound === "true") return;
  root.dataset.hatSectionCollapseBound = "true";
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("hat-pattern-section__collapse")) {
      return;
    }
    const section = t.closest(".hat-pattern-section");
    if (!(section instanceof HTMLElement)) return;
    const id = section.dataset.sectionId;
    if (!id) return;
    localStorage.setItem(`hatPattern_section_${id}`, t.checked ? "true" : "false");
    section.classList.toggle("is-collapsed", t.checked);
  });
}

function runHatPatternPrint(triggerEl: HTMLElement | null) {
  triggerPatternPrint(triggerEl, {});
}

function mountEditAction() {
  const editBtn = document.querySelector("[data-hat-edit-open]");
  if (!(editBtn instanceof HTMLElement)) return;
  editBtn.hidden = false;
  editBtn.style.display = "inline-flex";
}

function mountYarnAction() {
  const yarnBtn = document.querySelector("[data-hat-yarn-open]");
  if (!(yarnBtn instanceof HTMLElement)) return;
  yarnBtn.hidden = false;
  yarnBtn.style.display = "inline-flex";
}

function hideYarnAction() {
  const yarnBtn = document.querySelector("[data-hat-yarn-open]");
  if (!(yarnBtn instanceof HTMLElement)) return;
  yarnBtn.hidden = true;
  yarnBtn.style.display = "none";
  yarnBtn.setAttribute("aria-expanded", "false");
}

function yarnLengthUnitFromDraftUnit(unit: HatDisplayUnit): "in" | "cm" {
  return unit === "cm" ? "cm" : "in";
}

function syncHatPatternYarnDimensions(calc: HatPatternCalc, unit: HatDisplayUnit) {
  const detail = dispatchHatYarnDimensions(calc, yarnLengthUnitFromDraftUnit(unit));
  if (typeof window !== "undefined") {
    window.hatPatternLastYarnDimensions = detail;
    window.hatPatternLastCalc = calc;
  }
  return detail;
}

/** Sweater-parity yarn drawer open/close (express-yarn-drawer ids). */
export function initHatPatternYarnDrawer(): void {
  const drawerRoot = document.getElementById("express-yarn-drawer");
  const openBtn = document.getElementById("express-yarn-drawer-open");
  const closeBtn = document.getElementById("express-yarn-drawer-close");
  const backdrop = document.getElementById("express-yarn-drawer-backdrop");
  let lastFocus: HTMLElement | null = null;

  function openDrawer(): void {
    if (!drawerRoot) return;
    // Re-push dimensions so YarnRequirement picks them up even if it mounted after first render.
    const last = window.hatPatternLastCalc;
    if (last) {
      const priorUnit = window.hatPatternLastYarnDimensions?.lengthUnit === "cm" ? "cm" : "in";
      dispatchHatYarnDimensions(last, priorUnit);
    }
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRoot.classList.add("is-open");
    drawerRoot.setAttribute("aria-hidden", "false");
    document.body.classList.add("hat-yarn-drawer-open");
    openBtn?.setAttribute("aria-expanded", "true");
    window.setTimeout(() => {
      closeBtn?.focus();
    }, 0);
  }

  function closeDrawer(): void {
    if (!drawerRoot) return;
    drawerRoot.classList.remove("is-open");
    drawerRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hat-yarn-drawer-open");
    openBtn?.setAttribute("aria-expanded", "false");
    if (lastFocus) lastFocus.focus();
  }

  if (openBtn && openBtn.dataset.hatYarnDrawerBound !== "true") {
    openBtn.dataset.hatYarnDrawerBound = "true";
    openBtn.addEventListener("click", () => openDrawer());
  }
  if (closeBtn && closeBtn.dataset.hatYarnDrawerBound !== "true") {
    closeBtn.dataset.hatYarnDrawerBound = "true";
    closeBtn.addEventListener("click", () => closeDrawer());
  }
  if (backdrop && backdrop.dataset.hatYarnDrawerBound !== "true") {
    backdrop.dataset.hatYarnDrawerBound = "true";
    backdrop.addEventListener("click", () => closeDrawer());
  }
  if (drawerRoot && drawerRoot.dataset.hatYarnEscBound !== "true") {
    drawerRoot.dataset.hatYarnEscBound = "true";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerRoot.classList.contains("is-open")) {
        closeDrawer();
      }
    });
  }
}

function mountPrintAction() {
  const host = document.querySelector("[data-hat-pattern-actions]");
  if (!(host instanceof HTMLElement)) return;
  mountEditAction();
  mountYarnAction();
  let printBtn = host.querySelector("#print-btn");
  if (!(printBtn instanceof HTMLButtonElement)) {
    printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.id = "print-btn";
    printBtn.className = "sleeveless-pattern-print-action no-print";
    printBtn.setAttribute("data-testid", "button-print");
    printBtn.setAttribute("aria-label", "Print pattern");
    printBtn.innerHTML = `<i class="fas fa-print" aria-hidden="true"></i> Print`;
    host.appendChild(printBtn);
  }
  if (printBtn.dataset.hatPrintBound !== "true") {
    printBtn.dataset.hatPrintBound = "true";
    printBtn.addEventListener("click", () => {
      runHatPatternPrint(printBtn);
    });
  }
  printBtn.style.display = "inline-flex";
}

function bindInlinePrintLink() {
  const link = document.querySelector("[data-hat-pattern-print-link]");
  if (!(link instanceof HTMLElement) || link.dataset.hatPrintBound === "true") return;
  link.dataset.hatPrintBound = "true";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    runHatPatternPrint(link);
  });
}

function setVisible(el: Element | null, visible: boolean) {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function isLoggedInViewer(state: ViewerAccessState): boolean {
  return state === "memberAccess" || state === "loggedInNoAccess";
}

function showEmptyState(message: string) {
  const empty = document.querySelector("[data-hat-pattern-empty]");
  const results = document.querySelector("[data-hat-pattern-results]");
  const msg = document.querySelector("[data-hat-pattern-empty-message]");
  if (msg) msg.textContent = message;
  setHatLeadCaptureVisible(document, false);
  setVisible(empty, true);
  setVisible(results, false);
  const printBtn = document.querySelector("#print-btn");
  if (printBtn instanceof HTMLElement) printBtn.style.display = "none";
  const editBtn = document.querySelector("[data-hat-edit-open]");
  if (editBtn instanceof HTMLElement) {
    editBtn.hidden = true;
    editBtn.style.display = "none";
  }
  hideYarnAction();
}

function showResultsShell() {
  const empty = document.querySelector("[data-hat-pattern-empty]");
  const results = document.querySelector("[data-hat-pattern-results]");
  setHatLeadCaptureVisible(document, false);
  setVisible(empty, false);
  setVisible(results, true);
  mountPrintAction();
}

function showHatPatternLeadGate() {
  const empty = document.querySelector("[data-hat-pattern-empty]");
  const results = document.querySelector("[data-hat-pattern-results]");
  setVisible(empty, false);
  setVisible(results, false);
  const printBtn = document.querySelector("#print-btn");
  if (printBtn instanceof HTMLElement) printBtn.style.display = "none";
  const editBtn = document.querySelector("[data-hat-edit-open]");
  if (editBtn instanceof HTMLElement) {
    editBtn.hidden = true;
    editBtn.style.display = "none";
  }
  hideYarnAction();
  revealHatLeadCapture(document);
}

export async function renderHatPattern() {
  ensureHatDraftMigrated();
  const draft = readHatDraft();
  const rows = sizingRows();
  const result = buildHatPatternCalcFromDraft(draft, rows);

  if (!result.ok) {
    if (import.meta.env.DEV && result.detail) {
      console.warn("[hat-pattern]", result.reason, result.detail);
    }
    showEmptyState(result.message);
    return;
  }

  const { calc, unit, summary, draft: readyDraft } = result;
  showResultsShell();

  const tipsScope = document.querySelector("#hat-pattern-tips-scope");
  const showTips =
    tipsScope instanceof HTMLElement
      ? tipsScope.getAttribute("data-show-tips") !== "false"
      : localStorage.getItem("hat-show-tips") !== "false";

  const introEl = document.querySelector("[data-sg-pattern-intro]");
  if (introEl instanceof HTMLElement) {
    introEl.innerHTML = buildHatPatternSummaryDlHtml(summary, { inline: true });
  }
  const printBasics = document.querySelector("[data-sg-pattern-print-basics-body]");
  if (printBasics instanceof HTMLElement) {
    printBasics.innerHTML = buildHatPatternSummaryDlHtml(summary);
  }

  const heading = document.querySelector("[data-hat-pattern-online-heading]");
  if (heading instanceof HTMLElement) {
    heading.textContent = resolveHatPatternOnlineHeading(summary.sizeLabel, readyDraft);
  }

  applyPatternProjectOnlineNotes(
    getSleevelessPatternOnlineNotesText({
      title: readyDraft.patternProject?.title ?? "",
      notes: resolveHatPatternProjectNotes(readyDraft),
    }),
    { selectors: HAT_PATTERN_ONLINE_NOTES_SELECTORS },
  );

  const hatPrint = resolveHatPatternPrintFields({ draft: readyDraft });
  applyPatternPrintPersonalizationToDom(hatPrint.title, hatPrint.notes);

  applyHatPatternMembershipChrome(lastHatPatternViewerAccessState);

  const zeroBody = document.querySelector("[data-hat-zero-body-warning]");
  if (zeroBody instanceof HTMLElement) {
    zeroBody.hidden = calc.bodyRows > 0;
    if (calc.bodyRows <= 0 && import.meta.env.DEV) {
      console.warn("[hat-pattern]", HAT_ZERO_BODY_ROWS_WARNING);
    }
  }

  const mount = document.querySelector("[data-hat-pattern-mount]");
  if (!(mount instanceof HTMLElement)) {
    console.error("[hat-pattern] missing mount");
    return;
  }

  const patternHTML = buildHatPatternHtml({
    calc,
    currentUnit: unit,
    scrapOffPatternTooltip: scrapOffPatternTooltip(),
    tipsIntroHtml: "",
    showTips,
    formatters: { convertLength, formatLength },
  });
  mount.innerHTML = patternHTML;
  hydrateGlossaryTooltipPlaceholders(mount);
  if (tipsScope instanceof HTMLElement) {
    tipsScope.setAttribute("data-show-tips", showTips ? "true" : "false");
  }
  applyHatPatternSectionCollapseState(mount);
  bindHatPatternSectionCollapse(mount);

  if (import.meta.env.DEV) {
    console.log("[hat-pattern] calc", {
      castOnSts: calc.castOnSts,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
      crown: calc.crown,
      brimType: calc.brimType,
      hatHeight: calc.hatHeight,
      unit,
      sizeSel: readyDraft.sizeSel,
      fit: readyDraft.fit,
    });
  }

  const diagramHost = document.querySelector("[data-hat-diagram-tabs-mount]");
  if (diagramHost instanceof HTMLElement) {
    diagramHost.innerHTML = buildHatPatternDiagramTabsShellHtml();
    initHatPatternDiagramTabs(diagramHost);

    const stsHost = diagramHost.querySelector("[data-hat-diagram-sts-rows-host]");
    if (stsHost instanceof HTMLElement) {
      stsHost.innerHTML = buildHatPatternDiagramSvg(calc, unit, {
        convertLength,
        formatLengthWithUnit,
      }); // default mode: "pattern" — keeps stitch/row construction counts
    }

    const shapingHost = diagramHost.querySelector("[data-hat-diagram-shaping-host]");
    if (shapingHost instanceof HTMLElement) {
      shapingHost.innerHTML = buildHatShapingNotationDiagramSvg(calc, unit, {
        convertLength,
        formatLengthWithUnit,
      });
    }
  }

  syncHatPatternYarnDimensions(calc, unit);
  window.dispatchEvent(new CustomEvent("kbm:hat-pattern-rendered"));
}

export function initHatPatternPage() {
  const run = () => {
    let hatPatternHasRendered = false;
    let hatPatternReadyForLead = false;

    async function renderHatPatternIfAllowed() {
      if (hatPatternHasRendered) return;
      hatPatternHasRendered = true;
      setHatLeadCaptureVisible(document, false);
      try {
        await renderHatPattern();
      } catch (err) {
        console.error("[hat-pattern] render failed", err);
        showEmptyState(
          "We couldn't calculate this hat pattern from your saved choices. Return to the builder and try again.",
        );
      }
    }

    async function resolveLeadAndRender() {
      ensureHatDraftMigrated();
      const draftCheck = buildHatPatternCalcFromDraft(readHatDraft(), sizingRows());
      if (!draftCheck.ok) {
        showEmptyState(draftCheck.message);
        return;
      }
      const snapshot = readHatPatternAccessSnapshot();
      const snapshotLoggedIn = snapshot
        ? isLoggedInViewer(snapshot.viewerAccessState)
        : false;
      const next = await resolveHatPatternLeadContinue({
        alreadyCaptured: isHatPatternLeadRecognized(),
        memberLoggedIn:
          snapshotLoggedIn || isLoggedInViewer(lastHatPatternViewerAccessState),
      });
      if (next === "show-capture") {
        showHatPatternLeadGate();
        return;
      }
      await renderHatPatternIfAllowed();
    }

    bindInlinePrintLink();
    bindHatPatternMyPatternsDisabledGuard(document);
    initHatPatternNewPattern(document);
    initHatPatternYarnDrawer();
    bindHatLeadForm(document, () => renderHatPatternIfAllowed());
    // Listeners first, then snapshot, then Memberstack — never miss kin:member-access
    // and never re-fetch a plan-less payload that would downgrade memberAccess.
    bindHatPatternWorkspaceAccessLifecycle({
      apply: (state) => {
        applyHatPatternMembershipChrome(state);
        if (
          hatPatternReadyForLead &&
          isLoggedInViewer(state) &&
          !hatPatternHasRendered
        ) {
          void renderHatPatternIfAllowed();
        }
      },
    });
    const snapshot = readHatPatternAccessSnapshot();
    const mayNeedLeadGate =
      !isHatPatternLeadRecognized() &&
      !isLoggedInViewer(snapshot?.viewerAccessState ?? lastHatPatternViewerAccessState);
    if (mayNeedLeadGate) {
      const results = document.querySelector("[data-hat-pattern-results]");
      setVisible(results, false);
    }
    void (async () => {
      await ensureUrlRequestedSavedPatternHydrated();
      hatPatternReadyForLead = true;
      await resolveLeadAndRender();
    })();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

initHatPatternPage();

declare global {
  interface Window {
    hatPatternLastCalc?: HatPatternCalc;
    hatPatternLastYarnDimensions?: import("../lib/tools/yarnRequirementDimensions").YarnDimensionsDetail;
  }
}
