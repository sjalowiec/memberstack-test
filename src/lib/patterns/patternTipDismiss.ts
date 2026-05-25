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

export function resetDismissedTips(storageKey: string): void {
  localStorage.removeItem(dismissedTipsStorageKey(storageKey));
}

function notifySleevelessReadingWorkflowIfSaved(storageKey: string): void {
  if (storageKey !== SLEEVELESS_PATTERN_TIPS_STORAGE_KEY) return;
  try {
    scheduleReadingWorkflowSync(getCurrentPattern().id);
  } catch {
    /* not on a pattern page with draft */
  }
}

const DISMISSABLE_TIP_SELECTOR =
  ".pattern-tip[data-tip-id]:not(.pattern-tip-intro):not(.pattern-tips-control-box):not([data-pattern-print-personalization-tip])";

/** Top-of-pattern pink control banner (always visible; not affected by global tips hide). */
export function patternTipsControlBoxHtml(tipsOn: boolean): string {
  const toggleBtn = tipsOn
    ? '<button type="button" class="pattern-tips-control-btn tips-inline-toggle" data-testid="link-tips-toggle"><i class="fa-solid fa-xmark" aria-hidden="true"></i><span>Hide All</span></button>'
    : '<button type="button" class="pattern-tips-control-btn tips-inline-toggle" data-testid="link-tips-toggle"><i class="fa-solid fa-eye" aria-hidden="true"></i><span>Show All</span></button>';
  const resetBtn =
    '<button type="button" class="pattern-tips-control-btn pattern-tips-reset-dismissed" hidden><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>Reset All</span></button>';
  return (
    '<div class="pattern-tip pattern-tips-control-box pattern-tip-intro pattern-print-personalization-never-print" data-pattern-print-personalization-tip>' +
    '<div class="pattern-tips-control__layout">' +
    '<div class="pattern-tips-control__lead">' +
    '<i class="fa-solid fa-circle-info pattern-tips-control__info-icon" aria-hidden="true"></i>' +
    '<p class="pattern-tips-control__text">Pattern Tips give you quick, helpful reminders as you knit.</p>' +
    "</div>" +
    `<div class="pattern-tips-control__actions">${toggleBtn}${resetBtn}</div>` +
    "</div>" +
    "</div>"
  );
}

function isDismissableTip(el: Element): el is HTMLElement {
  return el.matches(DISMISSABLE_TIP_SELECTOR);
}

/** Inject dismiss buttons and apply persisted hidden state. */
export function refreshPatternTipDismiss(scope: Element, storageKey: string): void {
  const dismissed = loadDismissedTipIds(storageKey);
  scope.querySelectorAll(DISMISSABLE_TIP_SELECTOR).forEach((tip) => {
    const id = tip.getAttribute("data-tip-id");
    if (!id) return;
    if (dismissed.has(id)) {
      tip.setAttribute("data-tip-dismissed", "true");
    } else {
      tip.removeAttribute("data-tip-dismissed");
    }
    if (!tip.querySelector(".pattern-tip-dismiss")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pattern-tip-dismiss";
      btn.setAttribute("aria-label", "Hide this tip");
      btn.textContent = "\u00d7";
      tip.appendChild(btn);
    }
  });
}

function resolveResetControl(scopeOrReset: Element | null): HTMLElement | null {
  if (!(scopeOrReset instanceof HTMLElement)) return null;
  if (scopeOrReset.classList.contains("pattern-tips-reset-dismissed")) return scopeOrReset;
  const found = scopeOrReset.querySelector(".pattern-tips-reset-dismissed");
  return found instanceof HTMLElement ? found : null;
}

export function updateTipsResetLinkVisibility(scopeOrResetRow: Element | null, storageKey: string): void {
  const resetBtn = resolveResetControl(scopeOrResetRow);
  if (!resetBtn) return;
  const hasDismissed = loadDismissedTipIds(storageKey).size > 0;
  resetBtn.hidden = !hasDismissed;
}

export type PatternTipDismissBinding = {
  scope: Element;
  storageKey: string;
  resetRow: Element | null;
  observer: MutationObserver | null;
};

export function bindPatternTipDismiss(
  scope: Element,
  storageKey: string,
  resetRow: Element | null
): PatternTipDismissBinding {
  refreshPatternTipDismiss(scope, storageKey);
  updateTipsResetLinkVisibility(scope, storageKey);

  const alreadyBound = scope.getAttribute("data-pattern-tip-dismiss-bound") === storageKey;
  if (!alreadyBound) {
    scope.setAttribute("data-pattern-tip-dismiss-bound", storageKey);

    scope.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const dismissBtn = target.closest(".pattern-tip-dismiss");
      if (dismissBtn && scope.contains(dismissBtn)) {
        const tip = dismissBtn.closest(".pattern-tip");
        if (!tip || !isDismissableTip(tip)) return;
        const id = tip.getAttribute("data-tip-id");
        if (!id) return;
        e.preventDefault();
        dismissTipId(storageKey, id);
        tip.setAttribute("data-tip-dismissed", "true");
        updateTipsResetLinkVisibility(scope, storageKey);
        notifySleevelessReadingWorkflowIfSaved(storageKey);
        return;
      }

      const resetLink = target.closest(".pattern-tips-reset-dismissed");
      if (resetLink && scope.contains(resetLink)) {
        e.preventDefault();
        resetDismissedTips(storageKey);
        scope.querySelectorAll(".pattern-tip[data-tip-dismissed]").forEach((tip) => {
          tip.removeAttribute("data-tip-dismissed");
        });
        updateTipsResetLinkVisibility(scope, storageKey);
        notifySleevelessReadingWorkflowIfSaved(storageKey);
      }
    });

    const observer = new MutationObserver(() => {
      refreshPatternTipDismiss(scope, storageKey);
      updateTipsResetLinkVisibility(scope, storageKey);
    });
    observer.observe(scope, { childList: true, subtree: true });
    refreshPatternTipDismiss(scope, storageKey);
    updateTipsResetLinkVisibility(scope, storageKey);
    return { scope, storageKey, resetRow, observer };
  }

  refreshPatternTipDismiss(scope, storageKey);
  updateTipsResetLinkVisibility(scope, storageKey);
  return { scope, storageKey, resetRow, observer: null };
}
