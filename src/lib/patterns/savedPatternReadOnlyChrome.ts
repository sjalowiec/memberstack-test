/**
 * Hide mutate controls on a completed saved-pattern view for former members.
 * Server mutation APIs remain the backstop.
 */
export const SAVED_PATTERN_READONLY_MODE_ATTR = "data-saved-pattern-mode";

const READONLY_HIDE_SELECTORS = [
  "[data-socks-edit-open]",
  "[data-sl-edit-open]",
  "[data-testid='button-edit-pattern']",
  "[data-pattern-workspace-new-pattern-trigger]",
  "[data-cb-editing-banner-host]",
  "[data-cb-editing-banner-update]",
  "[data-cb-editing-banner-copy]",
  "[data-sl-edit-apply]",
  "[data-testid='button-edit-apply']",
  "[data-testid='button-recalculate']",
  "#express-start-over-btn",
  "#sideways-create-pattern",
  "[data-kbm-my-patterns-edit]",
  "[data-kbm-my-patterns-copy]",
  "[data-kbm-my-patterns-rename]",
  "[data-pattern-workspace-library-edit]",
  "[data-pattern-workspace-library-copy]",
  ".pattern-tips-toggle-host",
  "a[href*='edit=1']",
  "a[href*='edit=choices']",
  "a[href*='new=1']",
  "a[href*='/builder']",
  "a[href*='/edit/']",
  "a[href*='/custom-build']",
] as const;

function hideEl(el: Element): void {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.disabled = true;
  }
  if (el instanceof HTMLAnchorElement) {
    el.setAttribute("tabindex", "-1");
    el.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      { capture: true },
    );
  }
}

export function isSavedPatternReadOnlyDocument(doc: Document = document): boolean {
  const getAttr = doc?.documentElement?.getAttribute;
  if (typeof getAttr !== "function") return false;
  return (
    doc.documentElement.getAttribute(SAVED_PATTERN_READONLY_MODE_ATTR) === "readonly" ||
    doc.body?.getAttribute?.(SAVED_PATTERN_READONLY_MODE_ATTR) === "readonly"
  );
}

export function setSavedPatternReadOnlyDocument(enabled: boolean, doc: Document = document): void {
  if (enabled) {
    doc.documentElement.setAttribute(SAVED_PATTERN_READONLY_MODE_ATTR, "readonly");
    doc.body?.setAttribute(SAVED_PATTERN_READONLY_MODE_ATTR, "readonly");
  } else {
    doc.documentElement.removeAttribute(SAVED_PATTERN_READONLY_MODE_ATTR);
    doc.body?.removeAttribute(SAVED_PATTERN_READONLY_MODE_ATTR);
  }
}

export function applySavedPatternReadOnlyChrome(root: ParentNode = document): void {
  const doc =
    typeof Document !== "undefined" && root instanceof Document
      ? root
      : typeof document !== "undefined"
        ? document
        : null;
  if (doc) setSavedPatternReadOnlyDocument(true, doc);
  for (const selector of READONLY_HIDE_SELECTORS) {
    root.querySelectorAll(selector).forEach(hideEl);
  }
  root.querySelectorAll<HTMLTextAreaElement>("[data-pattern-project-notes], #sl-edit-notes").forEach((el) => {
    el.readOnly = true;
    el.disabled = true;
  });
  root.querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-pattern-reading-workflow]").forEach((el) => {
    el.disabled = true;
  });
}
