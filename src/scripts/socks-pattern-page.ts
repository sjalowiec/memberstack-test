/**
 * Finished Basic Socks Pattern page — draft → approved calc → instruction generator → renderer.
 * Membership-gated. Edit Pattern opens the dedicated Socks Edit workspace without clearing the draft.
 */

import { createSockSizingAdapter } from "../lib/patterns/sock/sockSizing";
import { readSockDraft } from "../lib/patterns/sock/sockDraft";
import { SOCK_EDIT_HREF } from "../lib/patterns/sock/sockPatternNavigation";
import {
  buildSockPatternFromDraft,
  buildSockPatternSummaryDlHtml,
  renderSockPatternPairHtml,
} from "../lib/patterns/sock/sockPatternPage";
import {
  initSockPairInstructionTabs,
  selectedSockPairTab,
} from "../lib/patterns/sock/sockPairInstructionTabs";
import {
  buildSockPatternDiagramTabsShellHtml,
  initSockPatternDiagramTabs,
} from "../lib/patterns/sock/sockPatternDiagramTabs";
import { buildSockPatternDiagramSvg } from "../lib/patterns/sock/sockPatternDiagramSvg";
import { buildSockShapingNotationDiagramSvg } from "../lib/patterns/sock/sockShapingNotationDiagramSvg";
import type { BasicSockCalc } from "../lib/patterns/sock/sockMath";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import { triggerPatternPrint } from "./patternPrintPersonalization.ts";

function loadSizingAdapterFromPage() {
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
  const empty = document.querySelector("[data-socks-pattern-empty]");
  const results = document.querySelector("[data-socks-pattern-results]");
  const msg = document.querySelector("[data-socks-pattern-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(results, false);
  const printBtn = document.querySelector("#print-btn");
  if (printBtn instanceof HTMLElement) printBtn.style.display = "none";
  const editBtn = document.querySelector("[data-socks-edit-open]");
  if (editBtn instanceof HTMLElement) {
    editBtn.hidden = true;
    editBtn.style.display = "none";
  }
}

function mountPrintAction(): void {
  const host = document.querySelector("[data-socks-pattern-actions]");
  if (!(host instanceof HTMLElement)) return;
  const editBtn = document.querySelector("[data-socks-edit-open]");
  if (editBtn instanceof HTMLElement) {
    if (editBtn instanceof HTMLAnchorElement) {
      editBtn.href = SOCK_EDIT_HREF;
    }
    editBtn.hidden = false;
    editBtn.style.display = "inline-flex";
  }
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
  if (printBtn.dataset.socksPrintBound !== "true") {
    printBtn.dataset.socksPrintBound = "true";
    printBtn.addEventListener("click", () => {
      triggerPatternPrint(printBtn, {});
    });
  }
  printBtn.style.display = "inline-flex";
}

function showResultsShell(): void {
  const empty = document.querySelector("[data-socks-pattern-empty]");
  const results = document.querySelector("[data-socks-pattern-results]");
  setVisible(empty, false);
  setVisible(results, true);
  mountPrintAction();
}

function fillSockDiagrams(calc: BasicSockCalc, mirror: boolean): void {
  const stsHost = document.querySelector("[data-sock-diagram-sts-rows-host]");
  if (stsHost instanceof HTMLElement) {
    stsHost.innerHTML = buildSockPatternDiagramSvg(calc, { mode: "pattern", mirror });
  }
  const shapingHost = document.querySelector("[data-sock-diagram-shaping-host]");
  if (shapingHost instanceof HTMLElement) {
    shapingHost.innerHTML = buildSockShapingNotationDiagramSvg(calc, { mirror });
  }
}

export async function renderSocksPattern(): Promise<void> {
  const adapter = loadSizingAdapterFromPage();
  const result = buildSockPatternFromDraft(readSockDraft(), adapter);
  if (!result.ok) {
    showEmptyState(result.message);
    return;
  }

  showResultsShell();

  const introEl = document.querySelector("[data-sg-pattern-intro]");
  if (introEl instanceof HTMLElement) {
    introEl.innerHTML = buildSockPatternSummaryDlHtml(result.view, { inline: true });
  }

  const heading = document.querySelector("[data-socks-pattern-online-heading]");
  if (heading instanceof HTMLElement) {
    heading.textContent = `${result.view.patternName} · ${result.view.constructionLabel}`;
  }

  const mount = document.querySelector("[data-socks-pattern-mount]");
  if (!(mount instanceof HTMLElement)) {
    console.error("[socks-pattern] missing mount");
    return;
  }
  mount.innerHTML = renderSockPatternPairHtml(result.sock1, result.sock2);
  hydrateGlossaryTooltipPlaceholders(mount);
  initSockPairInstructionTabs(mount);

  const diagramHost = document.querySelector("[data-sock-diagram-tabs-mount]");
  if (diagramHost instanceof HTMLElement) {
    diagramHost.innerHTML = buildSockPatternDiagramTabsShellHtml();
    initSockPatternDiagramTabs(diagramHost);
    fillSockDiagrams(result.calc, false);
    const pairRoot = mount.querySelector("[data-socks-pair-tabs]");
    if (pairRoot instanceof HTMLElement && pairRoot.dataset.sockDiagramMirrorBound !== "true") {
      pairRoot.dataset.sockDiagramMirrorBound = "true";
      pairRoot.addEventListener("click", (event) => {
        const from = event.target instanceof Element ? event.target : null;
        if (!from?.closest("[data-socks-pair-tab]")) return;
        fillSockDiagrams(result.calc, selectedSockPairTab(pairRoot) === "sock-2");
      });
    }
  }
}

async function initSocksPatternPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-socks-pattern-page]");
  if (!root || root.dataset.socksPatternBound === "true") return;
  root.dataset.socksPatternBound = "true";

  await reconcilePatternDraftOwner();
  await renderSocksPattern();
}

function boot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initSocksPatternPage(), { once: true });
  } else {
    void initSocksPatternPage();
  }
}

boot();
