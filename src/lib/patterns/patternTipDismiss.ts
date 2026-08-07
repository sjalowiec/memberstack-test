import { getCurrentPattern } from "./patternStorage";
import { SLEEVELESS_PATTERN_TIPS_STORAGE_KEY } from "./patternReadingWorkflow";
import { scheduleReadingWorkflowSync } from "./patternReadingWorkflowSync";

/** localStorage suffix for individually dismissed tip IDs (JSON string array). */
export function dismissedTipsStorageKey(storageKey: string): string {
  return `${storageKey}-dismissed`;
}

export function loadDismissedTipIds(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedTipsStorageKey(storageKey));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function saveDismissedTipIds(storageKey: string, ids: Set<string>): void {
  localStorage.setItem(dismissedTipsStorageKey(storageKey), JSON.stringify([...ids]));
}

export function dismissTipId(storageKey: string, tipId: string): void {
  const ids = loadDismissedTipIds(storageKey);
  ids.add(tipId);
  saveDismissedTipIds(storageKey, ids);
}

export function restoreTipId(storageKey: string, tipId: string): void {
  const ids = loadDismissedTipIds(storageKey);
  ids.delete(tipId);
  saveDismissedTipIds(storageKey, ids);
}

export function resetDismissedTips(storageKey: string): void {
  localStorage.removeItem(dismissedTipsStorageKey(storageKey));
}

/**
 * Clear individually dismissed tip IDs and restore tip DOM.
 * Call only when Show Tips deliberately transitions from OFF → ON.
 */
export function restoreAllDismissedPatternTips(scope: Element, storageKey: string): void {
  resetDismissedTips(storageKey);
  refreshPatternTipDismiss(scope, storageKey);
}

function notifySleevelessReadingWorkflowIfSaved(storageKey: string): void {
  if (storageKey !== SLEEVELESS_PATTERN_TIPS_STORAGE_KEY) return;
  try {
    scheduleReadingWorkflowSync(getCurrentPattern().id);
  } catch {
    /* not on a pattern page with draft */
  }
}

export const DISMISSABLE_TIP_SELECTOR =
  ".pattern-tip[data-tip-id]:not(.pattern-tip-intro):not(.pattern-tips-control-box):not([data-pattern-print-personalization-tip])";

/** Every tip wrapper carrying a stable id (includes duplicates in screen + print-only regions). */
export const TIP_WITH_ID_SELECTOR = ".pattern-tip[data-tip-id]";

/** Top-of-pattern pink control banner (always visible; not affected by global tips hide). */
export function patternTipsControlBoxHtml(tipsOn: boolean): string {
  const checked = tipsOn ? "true" : "false";
  const stateLabel = tipsOn ? "Tips visible" : "Tips hidden";
  const toggle =
    `<button type="button" role="switch" aria-checked="${checked}" ` +
    'class="pattern-tips-switch tips-inline-toggle" data-testid="link-tips-toggle">' +
    '<span class="pattern-tips-switch__label">Show Tips</span>' +
    '<span class="pattern-tips-switch__track" aria-hidden="true"><span class="pattern-tips-switch__thumb"></span></span>' +
    `<span class="pattern-tips-switch__state">${stateLabel}</span>` +
    "</button>";
  return (
    '<div class="pattern-tip pattern-tips-control-box pattern-tip-intro pattern-print-personalization-never-print" data-pattern-print-personalization-tip>' +
    '<div class="pattern-tips-control__layout">' +
    '<div class="pattern-tips-control__lead">' +
    '<i class="fa-solid fa-circle-info pattern-tips-control__info-icon" aria-hidden="true"></i>' +
    '<p class="pattern-tips-control__text">Pattern Tips give you quick, helpful reminders as you knit.</p>' +
    "</div>" +
    `<div class="pattern-tips-control__actions">${toggle}</div>` +
    "</div>" +
    "</div>"
  );
}

function isDismissableTip(el: Element): el is HTMLElement {
  return el.matches(DISMISSABLE_TIP_SELECTOR);
}

function tipHasDirectDismissButton(tip: Element): boolean {
  for (const child of tip.children) {
    if (child instanceof HTMLElement && child.classList.contains("pattern-tip-dismiss")) {
      return true;
    }
  }
  return false;
}

/** Resolve the dismissable tip wrapper that owns a dismiss button. */
export function resolveDismissableTipFromDismissButton(dismissBtn: Element): HTMLElement | null {
  const parent = dismissBtn.parentElement;
  if (parent && isDismissableTip(parent)) {
    return parent;
  }
  const tip = dismissBtn.closest(".pattern-tip");
  if (tip && isDismissableTip(tip)) {
    return tip;
  }
  return null;
}

function tipWrappersWithId(scope: Element, tipId: string): HTMLElement[] {
  const matches: HTMLElement[] = [];
  scope.querySelectorAll(TIP_WITH_ID_SELECTOR).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.getAttribute("data-tip-id") === tipId) matches.push(el);
  });
  return matches;
}

/** Mirrors {@link pattern-tips.css} print hide rules for unit tests (not full layout CSS). */
export function isTipHiddenForPrint(tip: HTMLElement, globalTipsVisible: boolean): boolean {
  if (tip.classList.contains("pattern-tips-control-box")) return true;
  if (!globalTipsVisible) return true;
  if (tip.hasAttribute("data-tip-dismissed")) return true;
  if (tip.classList.contains("pattern-print-personalization-never-print")) return true;
  if (tip.hasAttribute("data-pattern-print-personalization-tip")) return true;
  return false;
}

function syncTipDismissedDomForId(scope: Element, tipId: string, dismissed: boolean): void {
  for (const tip of tipWrappersWithId(scope, tipId)) {
    if (dismissed) {
      tip.setAttribute("data-tip-dismissed", "true");
    } else {
      tip.removeAttribute("data-tip-dismissed");
    }
  }
}

/** Remove stale per-tip hide flags that no longer match persisted dismissal state. */
function clearStaleTipDismissedAttributes(scope: Element, dismissed: Set<string>): void {
  scope.querySelectorAll(".pattern-tip[data-tip-dismissed]").forEach((tip) => {
    if (!(tip instanceof HTMLElement)) return;
    const id = tip.getAttribute("data-tip-id");
    if (!id || !dismissed.has(id)) {
      tip.removeAttribute("data-tip-dismissed");
    }
  });
}

function setTipDismissedState(
  scope: Element,
  storageKey: string,
  tip: HTMLElement,
  dismissed: boolean,
): void {
  const id = tip.getAttribute("data-tip-id");
  if (!id) return;
  if (dismissed) {
    dismissTipId(storageKey, id);
  } else {
    restoreTipId(storageKey, id);
  }
  syncTipDismissedDomForId(scope, id, dismissed);
}

/** Inject dismiss buttons and apply persisted hidden state to every matching tip wrapper. */
export function refreshPatternTipDismiss(scope: Element, storageKey: string): void {
  const dismissed = loadDismissedTipIds(storageKey);
  clearStaleTipDismissedAttributes(scope, dismissed);

  scope.querySelectorAll(DISMISSABLE_TIP_SELECTOR).forEach((tip) => {
    if (!(tip instanceof HTMLElement)) return;
    const id = tip.getAttribute("data-tip-id");
    if (!id) return;
    syncTipDismissedDomForId(scope, id, dismissed.has(id));

    if (!tipHasDirectDismissButton(tip)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pattern-tip-dismiss";
      btn.setAttribute("aria-label", "Hide this tip");
      btn.textContent = "\u00d7";
      tip.appendChild(btn);
    }
  });
}

/** Re-read persisted dismissal state into the live DOM immediately before print preview. */
export function syncPatternTipDismissBeforePrint(scope: Element, storageKey: string): void {
  refreshPatternTipDismiss(scope, storageKey);
}

const printSyncScopes = new Map<Element, string>();
let beforePrintListenerBound = false;

function bindBeforePrintListenerOnce(): void {
  if (beforePrintListenerBound || typeof window === "undefined") return;
  beforePrintListenerBound = true;
  window.addEventListener("beforeprint", () => {
    for (const [scope, storageKey] of printSyncScopes) {
      if (!scope.isConnected) {
        printSyncScopes.delete(scope);
        continue;
      }
      syncPatternTipDismissBeforePrint(scope, storageKey);
    }
  });
}

function registerPrintSyncScope(scope: Element, storageKey: string): void {
  printSyncScopes.set(scope, storageKey);
  bindBeforePrintListenerOnce();
}

export type PatternTipDismissBinding = {
  scope: Element;
  storageKey: string;
  observer: MutationObserver | null;
};

export function bindPatternTipDismiss(scope: Element, storageKey: string): PatternTipDismissBinding {
  registerPrintSyncScope(scope, storageKey);
  refreshPatternTipDismiss(scope, storageKey);

  const alreadyBound = scope.getAttribute("data-pattern-tip-dismiss-bound") === storageKey;
  if (!alreadyBound) {
    scope.setAttribute("data-pattern-tip-dismiss-bound", storageKey);

    scope.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const dismissBtn = target.closest(".pattern-tip-dismiss");
      if (dismissBtn && scope.contains(dismissBtn)) {
        const tip = resolveDismissableTipFromDismissButton(dismissBtn);
        if (!tip) return;
        const id = tip.getAttribute("data-tip-id");
        if (!id) return;
        e.preventDefault();
        setTipDismissedState(scope, storageKey, tip, true);
        notifySleevelessReadingWorkflowIfSaved(storageKey);
      }
    });

    const observer = new MutationObserver(() => {
      refreshPatternTipDismiss(scope, storageKey);
    });
    observer.observe(scope, { childList: true, subtree: true });
    refreshPatternTipDismiss(scope, storageKey);
    return { scope, storageKey, observer };
  }

  refreshPatternTipDismiss(scope, storageKey);
  return { scope, storageKey, observer: null };
}

/** @internal Tests only — reset the global beforeprint registration. */
export function resetPatternTipPrintSyncForTests(): void {
  printSyncScopes.clear();
  beforePrintListenerBound = false;
}
