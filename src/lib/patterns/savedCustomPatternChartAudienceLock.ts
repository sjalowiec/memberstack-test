/**
 * Locks sizing chart / audience when editing a saved custom pattern.
 * Same-chart size edits stay allowed; cross-chart audience changes are blocked in the UI.
 */
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { chartAudienceToExpressWho } from "./restoreSleevelessExpressBuilderFromPattern";
import {
  buildSizingIdentityFromCanonicalDraft,
  readSavedSizingIdentityBaseline,
  type SavedCustomPatternSizingIdentity,
} from "./savedCustomPatternSessionIdentity";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";

export const SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR =
  "[data-saved-pattern-audience-lock-notice]";

export const SAVED_PATTERN_AUDIENCE_LOCKED_WHO_CLASS = "express-who-card--audience-locked";

function isElementLike(el: unknown): el is HTMLElement {
  return (
    typeof el === "object" &&
    el !== null &&
    "getAttribute" in el &&
    "classList" in el &&
    typeof (el as HTMLElement).getAttribute === "function"
  );
}

const CHART_AUDIENCE_SIZING_LABEL: Record<string, string> = {
  misses: "Women",
  men: "Men",
  kids: "Child",
  baby: "Baby",
};

export function chartAudienceSizingChartLabel(chartAudience: string): string {
  const key = String(chartAudience ?? "").trim().toLowerCase();
  return CHART_AUDIENCE_SIZING_LABEL[key] ?? (key || "this");
}

export function expressWhoSizingChartLabel(expressWho: string): string {
  return chartAudienceSizingChartLabel(expressWhoToChartAudience(expressWho));
}

/** Baseline chart audience while editing a saved project, or null when not locked. */
export function resolveLockedChartAudienceForSavedEdit(): string | null {
  if (!isEditingSavedCustomPatternProject()) return null;
  const baseline = readSavedSizingIdentityBaseline();
  const fromBaseline = baseline?.chartAudience?.trim();
  if (fromBaseline) return fromBaseline;
  return buildSizingIdentityFromCanonicalDraft()?.chartAudience?.trim() || null;
}

/** Align wizard `who` with the locked chart when opening a saved project. */
export function enforceLockedExpressWhoInWizardValues(values: Record<string, string>): void {
  const lockedWho = resolveLockedExpressWhoForSavedEdit();
  if (!lockedWho) return;
  const current = String(values.who ?? "").trim().toLowerCase();
  if (current && current !== lockedWho.trim().toLowerCase()) {
    delete values.selectedSize;
  }
  values.who = lockedWho;
}

/** Express `who` value for the locked chart audience. */
export function resolveLockedExpressWhoForSavedEdit(): string | null {
  const chartAudience = resolveLockedChartAudienceForSavedEdit();
  if (!chartAudience) return null;
  return chartAudienceToExpressWho(chartAudience);
}

export function formatSavedPatternChartAudienceLockMessage(
  lockedChartAudience: string,
  attemptedChartAudience?: string,
): string {
  const lockedLabel = chartAudienceSizingChartLabel(lockedChartAudience);
  if (attemptedChartAudience && attemptedChartAudience.trim()) {
    const attemptedLabel = chartAudienceSizingChartLabel(attemptedChartAudience);
    return `This saved pattern uses the ${lockedLabel} sizing chart. To use ${attemptedLabel} sizing, start a new pattern instead.`;
  }
  return `This saved pattern uses the ${lockedLabel} sizing chart. To use a different sizing chart, start a new pattern instead.`;
}

export function shouldBlockExpressWhoChangeForSavedEdit(attemptedExpressWho: string): boolean {
  const lockedWho = resolveLockedExpressWhoForSavedEdit();
  if (!lockedWho) return false;
  const attempted = String(attemptedExpressWho ?? "").trim().toLowerCase();
  if (!attempted) return false;
  return attempted !== lockedWho.trim().toLowerCase();
}

export type SavedPatternChartAudienceLockNoticeActions = {
  onContinueEditing?: () => void;
  onStartNewPattern?: () => void;
};

/** Apply locked / unlocked styling on Who picker buttons. */
export function applySavedPatternChartAudienceLockToWhoPicker(
  root: ParentNode | null | undefined,
  lockedExpressWho: string | null,
): void {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('[data-choice][data-field="who"]').forEach((el) => {
    if (!isElementLike(el)) return;
    const who = el.getAttribute("data-value")?.trim().toLowerCase() ?? "";
    const isLockedChoice =
      Boolean(lockedExpressWho) && who !== lockedExpressWho.trim().toLowerCase();
    el.classList.toggle(SAVED_PATTERN_AUDIENCE_LOCKED_WHO_CLASS, isLockedChoice);
    if (isLockedChoice) {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
    } else {
      el.removeAttribute("aria-disabled");
      el.removeAttribute("tabindex");
    }
  });
}

function findOrCreateAudienceLockNotice(host: HTMLElement): HTMLElement {
  let notice = host.querySelector(SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR);
  if (isElementLike(notice)) return notice;

  notice = document.createElement("div");
  notice.className = "saved-pattern-audience-lock-notice";
  notice.setAttribute("data-saved-pattern-audience-lock-notice", "");
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.hidden = true;

  const whoGrid = host.querySelector(".express-options--who");
  if (whoGrid?.parentNode) {
    whoGrid.parentNode.insertBefore(notice, whoGrid.nextSibling);
  } else {
    host.appendChild(notice);
  }
  return notice;
}

export function showSavedPatternChartAudienceLockNotice(
  host: HTMLElement | null | undefined,
  message: string,
  actions: SavedPatternChartAudienceLockNoticeActions = {},
): void {
  if (!host || typeof document === "undefined") return;

  const notice = findOrCreateAudienceLockNotice(host);
  notice.replaceChildren();

  const text = document.createElement("p");
  text.className = "saved-pattern-audience-lock-notice__text";
  text.textContent = message;
  notice.appendChild(text);

  const actionRow = document.createElement("div");
  actionRow.className = "saved-pattern-audience-lock-notice__actions";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "saved-pattern-audience-lock-notice__btn";
  continueBtn.textContent = "Continue editing";
  continueBtn.addEventListener("click", () => {
    hideSavedPatternChartAudienceLockNotice(host);
    actions.onContinueEditing?.();
  });
  actionRow.appendChild(continueBtn);

  const startNewBtn = document.createElement("button");
  startNewBtn.type = "button";
  startNewBtn.className =
    "saved-pattern-audience-lock-notice__btn saved-pattern-audience-lock-notice__btn--primary";
  startNewBtn.textContent = "Start a new pattern";
  startNewBtn.addEventListener("click", () => {
    hideSavedPatternChartAudienceLockNotice(host);
    actions.onStartNewPattern?.();
  });
  actionRow.appendChild(startNewBtn);

  notice.appendChild(actionRow);
  notice.hidden = false;
}

export function hideSavedPatternChartAudienceLockNotice(
  host: ParentNode | null | undefined,
): void {
  const notice = host?.querySelector?.(SAVED_PATTERN_AUDIENCE_LOCK_NOTICE_SELECTOR);
  if (isElementLike(notice)) {
    notice.hidden = true;
    notice.replaceChildren();
  }
}

export function syncSavedPatternChartAudienceLockUi(
  host: HTMLElement | null | undefined,
  actions: SavedPatternChartAudienceLockNoticeActions = {},
): void {
  const lockedWho = resolveLockedExpressWhoForSavedEdit();
  applySavedPatternChartAudienceLockToWhoPicker(host, lockedWho);
  if (!lockedWho) {
    hideSavedPatternChartAudienceLockNotice(host);
  }
}

export function interceptBlockedExpressWhoChange(
  host: HTMLElement | null | undefined,
  attemptedExpressWho: string,
  actions: SavedPatternChartAudienceLockNoticeActions = {},
): boolean {
  if (!shouldBlockExpressWhoChangeForSavedEdit(attemptedExpressWho)) return false;

  const locked = resolveLockedChartAudienceForSavedEdit();
  const attempted = expressWhoToChartAudience(attemptedExpressWho);
  if (host && locked) {
    showSavedPatternChartAudienceLockNotice(
      host,
      formatSavedPatternChartAudienceLockMessage(locked, attempted),
      actions,
    );
  }
  return true;
}

/** @internal Test helper — baseline identity used for lock resolution. */
export function lockedSizingIdentityForTests(): SavedCustomPatternSizingIdentity | null {
  return readSavedSizingIdentityBaseline();
}
