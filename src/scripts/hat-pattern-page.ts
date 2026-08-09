/**
 * Finished Hat Pattern page — draft → calc → instructions + diagram.
 * Free / ungated. Edit Pattern drawer edits the same draft + existing hat math (no new route).
 */

import {
  convertLength,
  formatLength,
  formatLengthWithUnit,
} from "../components/wizards/utils/unitHelpers";
import { getViewerAccessState, type ViewerAccessState } from "../lib/memberAccess";
import { buildHatSizingBuilderRows } from "../lib/patterns/hat/hatBuilderSizingLabels";
import { ensureHatDraftMigrated, readHatDraft } from "../lib/patterns/hat/hatDraft";
import { buildHatPatternDiagramSvg } from "../lib/patterns/hat/hatPatternDiagramSvg";
import { buildHatPatternHtml } from "../lib/patterns/hat/hatInstructions";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import {
  buildHatPatternCalcFromDraft,
  buildHatPatternSummaryDlHtml,
  type HatSizingPatternRow,
} from "../lib/patterns/hat/hatPatternFromDraft";
import { applyHatPatternPersistNoticeMembership } from "../lib/patterns/hat/hatPatternPersistNotice";
import {
  waitForMemberstackDom,
  waitForMemberstackReady,
} from "../lib/patterns/sleevelessPatternLoginGate";
import { initHatPatternEditDrawer } from "./hat-pattern-edit-drawer.ts";
import { triggerPatternPrint } from "./patternPrintPersonalization.ts";
import hatSizingRows from "../data/sizing_hats.json";

const HAT_ZERO_BODY_ROWS_WARNING =
  "Your current settings don't leave any room for the body of the hat. Try increasing the finished hat length, reducing the brim height, or choosing a shallower crown style.";

async function resolveHatPatternViewerAccessState(): Promise<ViewerAccessState> {
  if (typeof window === "undefined") return "loggedOut";
  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return "loggedOut";
  try {
    await waitForMemberstackReady(ms);
    const res = await ms.getCurrentMember();
    return getViewerAccessState(res);
  } catch {
    return "loggedOut";
  }
}

async function syncHatPatternPersistNoticeMembership(): Promise<void> {
  const state = await resolveHatPatternViewerAccessState();
  applyHatPatternPersistNoticeMembership(document, state);
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

function mountPrintAction() {
  const host = document.querySelector("[data-hat-pattern-actions]");
  if (!(host instanceof HTMLElement)) return;
  mountEditAction();
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

function showEmptyState(message: string) {
  const empty = document.querySelector("[data-hat-pattern-empty]");
  const results = document.querySelector("[data-hat-pattern-results]");
  const msg = document.querySelector("[data-hat-pattern-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(results, false);
  const printBtn = document.querySelector("#print-btn");
  if (printBtn instanceof HTMLElement) printBtn.style.display = "none";
  const editBtn = document.querySelector("[data-hat-edit-open]");
  if (editBtn instanceof HTMLElement) {
    editBtn.hidden = true;
    editBtn.style.display = "none";
  }
}

function showResultsShell() {
  const empty = document.querySelector("[data-hat-pattern-empty]");
  const results = document.querySelector("[data-hat-pattern-results]");
  setVisible(empty, false);
  setVisible(results, true);
  mountPrintAction();
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
    heading.textContent = `Hat Pattern · ${summary.sizeLabel}`;
  }

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

  const diagramHost = document.querySelector("#diagram-content");
  if (diagramHost instanceof HTMLElement) {
    diagramHost.innerHTML = buildHatPatternDiagramSvg(calc, unit, {
      convertLength,
      formatLengthWithUnit,
    });
  }

  window.dispatchEvent(new CustomEvent("kbm:hat-pattern-rendered"));
}

export function initHatPatternPage() {
  const run = () => {
    bindInlinePrintLink();
    initHatPatternEditDrawer({
      sizingRows: sizingRows(),
      onUpdated: () => renderHatPattern(),
    });
    void syncHatPatternPersistNoticeMembership().catch(() => {
      applyHatPatternPersistNoticeMembership(document, "loggedOut");
    });
    void renderHatPattern().catch((err) => {
      console.error("[hat-pattern] render failed", err);
      showEmptyState(
        "We couldn't calculate this hat pattern from your saved choices. Return to the builder and try again.",
      );
    });

    const ms = window.$memberstackDom;
    if (ms && typeof ms.on === "function") {
      try {
        ms.on("member.login", () => {
          void syncHatPatternPersistNoticeMembership();
        });
        ms.on("member.logout", () => {
          applyHatPatternPersistNoticeMembership(document, "loggedOut");
        });
      } catch {
        /* memberstack event wiring is best-effort */
      }
    }
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
    hatPatternLastCalc?: unknown;
  }
}
