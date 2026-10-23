/**
 * Finished Christmas Stocking Pattern page — draft → approved calc → instruction generator → renderer.
 * Membership-gated. Edit Pattern opens the dedicated Socks Edit workspace without clearing the draft.
 */

import { createSockSizingAdapter } from "../lib/patterns/christmasStocking/sockSizing";
import { readSockDraft } from "../lib/patterns/christmasStocking/sockDraft";
import { SOCK_EDIT_HREF } from "../lib/patterns/christmasStocking/sockPatternNavigation";
import {
  buildSockPatternFromDraft,
  buildSockPatternSummaryDlHtml,
} from "../lib/patterns/christmasStocking/sockPatternPage";
import {
  mountPatternPrintAction,
  setPatternPrintActionVisible,
  syncPatternInpageNav,
} from "../lib/patterns/patternInpageNav";
import { sockPatternInpageNavItems } from "../lib/patterns/christmasStocking/sockPatternInpageNav";
import {
  buildSockPatternDiagramTabsShellHtml,
  initSockPatternDiagramTabs,
} from "../lib/patterns/christmasStocking/sockPatternDiagramTabs";
import { buildSockPatternDiagramSvg } from "../lib/patterns/sock/sockPatternDiagramSvg";
import { buildSockShapingNotationDiagramSvg } from "../lib/patterns/sock/sockShapingNotationDiagramSvg";
import {
  SLEEVELESS_DIAGRAM_INLINE_CLASS,
  bindSleevelessDiagramZoom,
  closeSleevelessDiagramModal,
  ensureSleevelessDiagramModal,
} from "../lib/patterns/sleevelessDiagramModal";
import type { BasicSockCalc } from "../lib/patterns/sock/sockMath";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";
import { applySavedPatternUnavailableMessage, ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import {
  applySavedPatternReadOnlyChrome,
  isSavedPatternReadOnlyDocument,
} from "../lib/patterns/savedPatternReadOnlyChrome";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import { triggerPatternPrint } from "./patternPrintPersonalization.ts";

function loadSizingAdapterFromPage() {
  const node = document.getElementById("christmas-stocking-sizing-chart");
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
  const empty = document.querySelector("[data-christmas-stocking-pattern-empty]");
  const results = document.querySelector("[data-christmas-stocking-pattern-results]");
  const msg = document.querySelector("[data-christmas-stocking-pattern-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(results, false);
  setPatternPrintActionVisible(document.querySelector("#print-btn"), false);
  const editBtn = document.querySelector("[data-christmas-stocking-edit-open]");
  if (editBtn instanceof HTMLElement) {
    editBtn.hidden = true;
    editBtn.style.display = "none";
  }
}

function mountPrintAction(): void {
  const host = document.querySelector("[data-christmas-stocking-pattern-actions]");
  if (!(host instanceof HTMLElement)) return;
  const editBtn = document.querySelector("[data-christmas-stocking-edit-open]");
  if (editBtn instanceof HTMLElement) {
    if (isSavedPatternReadOnlyDocument()) {
      editBtn.hidden = true;
      editBtn.style.display = "none";
    } else {
      if (editBtn instanceof HTMLAnchorElement) {
        editBtn.href = SOCK_EDIT_HREF;
      }
      editBtn.hidden = false;
      editBtn.style.display = "inline-flex";
    }
  }
  mountPatternPrintAction({
    host,
    visible: true,
    onPrint: (button) => {
      triggerPatternPrint(button, {});
    },
  });
}

function showResultsShell(): void {
  const empty = document.querySelector("[data-christmas-stocking-pattern-empty]");
  const results = document.querySelector("[data-christmas-stocking-pattern-results]");
  setVisible(empty, false);
  setVisible(results, true);
  mountPrintAction();
}

function markSockDiagramForEnlarge(host: HTMLElement): void {
  const svg = host.querySelector("svg");
  if (svg) svg.classList.add(SLEEVELESS_DIAGRAM_INLINE_CLASS);
}

function fillSockDiagrams(calc: BasicSockCalc, mirror: boolean): void {
  closeSleevelessDiagramModal();
  const stsHost = document.querySelector("[data-sock-diagram-sts-rows-host]");
  if (stsHost instanceof HTMLElement) {
    stsHost.innerHTML = buildSockPatternDiagramSvg(calc, {
      mode: "pattern",
      mirror,
      family: "christmas-stocking",
    }).replace(
      'aria-label="Basic Socks stitches and rows"',
      'aria-label="Christmas Stocking stitches and rows"',
    );
    markSockDiagramForEnlarge(stsHost);
  }
  const shapingHost = document.querySelector("[data-sock-diagram-shaping-host]");
  if (shapingHost instanceof HTMLElement) {
    shapingHost.innerHTML = buildSockShapingNotationDiagramSvg(calc, {
      mirror,
      family: "christmas-stocking",
    }).replace(
      'aria-label="Basic Socks shaping notation"',
      'aria-label="Christmas Stocking shaping notation"',
    );
    markSockDiagramForEnlarge(shapingHost);
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

  const heading = document.querySelector("[data-christmas-stocking-pattern-online-heading]");
  if (heading instanceof HTMLElement) {
    heading.textContent = `${result.view.patternName} · ${result.view.constructionLabel}`;
  }

  const mount = document.querySelector("[data-christmas-stocking-pattern-mount]");
  if (!(mount instanceof HTMLElement)) {
    console.error("[christmas-stocking-pattern] missing mount");
    return;
  }
  mount.innerHTML = result.instructionsHtml;
  hydrateGlossaryTooltipPlaceholders(mount);
  syncPatternInpageNav({ items: sockPatternInpageNavItems(result.instructions) });

  const diagramHost = document.querySelector("[data-sock-diagram-tabs-mount]");
  if (diagramHost instanceof HTMLElement) {
    diagramHost.innerHTML = buildSockPatternDiagramTabsShellHtml();
    initSockPatternDiagramTabs(diagramHost);
    ensureSleevelessDiagramModal();
    bindSleevelessDiagramZoom(diagramHost);
    fillSockDiagrams(result.calc, false);
  }
}

async function initSocksPatternPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-christmas-stocking-pattern-page]");
  if (!root || root.dataset.socksPatternBound === "true") return;
  root.dataset.socksPatternBound = "true";

  await reconcilePatternDraftOwner();
  const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
  if (hydrateOutcome === "load-failed") {
    applySavedPatternUnavailableMessage();
    showEmptyState(SAVED_PATTERN_UNAVAILABLE_BODY);
    const emptyCta = document.querySelector("[data-testid='christmas-stocking-pattern-empty-cta']");
    if (emptyCta instanceof HTMLElement) emptyCta.hidden = true;
    return;
  }
  await renderSocksPattern();
  if (isSavedPatternReadOnlyDocument()) {
    applySavedPatternReadOnlyChrome(document);
  }
}

function boot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initSocksPatternPage(), { once: true });
  } else {
    void initSocksPatternPage();
  }
}

boot();
