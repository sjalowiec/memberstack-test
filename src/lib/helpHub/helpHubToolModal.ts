/**
 * Help Hub related-tool dialog.
 *
 * This is a custom dialog rather than <dialog>.showModal(). Memberstack login
 * renders outside the tool (in memberstack-prebuilt-ui). A native modal would
 * mark that login inert, so visitors could not use the existing join/login options.
 */

export const HELP_HUB_TOOL_HOST_SELECTOR = "[data-help-hub-tool]";
export const HELP_HUB_TOOL_OPEN_SELECTOR = "[data-help-hub-tool-open]";
export const HELP_HUB_TOOL_MODAL_SELECTOR = "[data-help-hub-tool-modal]";
export const HELP_HUB_TOOL_CLOSE_SELECTOR = "[data-help-hub-tool-close]";
export const HELP_HUB_TOOL_BODY_SELECTOR = "[data-help-hub-tool-body]";

const BOUND_ATTR = "data-help-hub-tool-bound";
const INERT_ATTR = "data-help-hub-tool-made-inert";
const MEMBERSTACK_HOST = "MEMBERSTACK-PREBUILT-UI";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

type Session = {
  opener: HTMLElement | null;
  scrollY: number;
  observer: MutationObserver | null;
};

const sessions = new WeakMap<HTMLElement, Session>();
let activeDialog: HTMLElement | null = null;
let keydownBound = false;

function isMemberstackHost(el: Element): boolean {
  return el.tagName === MEMBERSTACK_HOST || el.id === "kbm-ms-login-proxy";
}

export function helpHubToolFocusable(dialog: ParentNode): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled") || el.hasAttribute("inert")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[hidden], [inert]")) return false;
    return true;
  });
}

/** Keep Tab and Shift+Tab inside the open tool dialog. */
export function trapHelpHubToolFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = helpHubToolFocusable(dialog);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement;
  const active =
    activeElement && typeof (activeElement as HTMLElement).focus === "function"
      ? (activeElement as HTMLElement)
      : null;
  const inside = active != null && dialog.contains(active);
  if (event.shiftKey && (!inside || active === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

export function lockHelpHubToolPageScroll(): number {
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const body = document.body;
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  return scrollY;
}

export function unlockHelpHubToolPageScroll(scrollY: number): void {
  const body = document.body;
  const root = document.documentElement;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  const apply = () => window.scrollTo(0, scrollY);
  apply();
  // Removing position:fixed resets scroll after this turn. Apply again on the next frame.
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      apply();
      root.style.scrollBehavior = previousBehavior;
    });
  } else {
    root.style.scrollBehavior = previousBehavior;
  }
}

function raiseMemberstackHosts(): void {
  document.querySelectorAll(MEMBERSTACK_HOST).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset.helpHubToolMsRaised === "true") return;
    el.dataset.helpHubToolMsRaised = "true";
    el.dataset.helpHubToolMsPosition = el.style.position;
    el.dataset.helpHubToolMsZ = el.style.zIndex;
    el.style.position = "relative";
    el.style.zIndex = "100000";
  });
}

function restoreMemberstackHosts(): void {
  document.querySelectorAll(MEMBERSTACK_HOST).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset.helpHubToolMsRaised !== "true") return;
    el.style.position = el.dataset.helpHubToolMsPosition ?? "";
    el.style.zIndex = el.dataset.helpHubToolMsZ ?? "";
    delete el.dataset.helpHubToolMsRaised;
    delete el.dataset.helpHubToolMsPosition;
    delete el.dataset.helpHubToolMsZ;
  });
}

function inertBackground(dialog: HTMLElement): void {
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === dialog || isMemberstackHost(child)) {
      if (child.hasAttribute(INERT_ATTR)) {
        child.removeAttribute("inert");
        child.removeAttribute(INERT_ATTR);
      }
      continue;
    }
    if (child.hasAttribute(INERT_ATTR) || child.hasAttribute("inert")) continue;
    child.setAttribute("inert", "");
    child.setAttribute(INERT_ATTR, "");
  }
}

function restoreBackground(): void {
  document.querySelectorAll(`[${INERT_ATTR}]`).forEach((el) => {
    el.removeAttribute("inert");
    el.removeAttribute(INERT_ATTR);
  });
}

function focusWithoutScroll(el: HTMLElement): void {
  if (typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function memberstackHasFocus(): boolean {
  return document.activeElement?.tagName === MEMBERSTACK_HOST;
}

function closeHelpHubToolModal(dialog: HTMLElement): void {
  if (activeDialog !== dialog) return;
  const session = sessions.get(dialog);
  activeDialog = null;
  dialog.setAttribute("hidden", "");
  session?.observer?.disconnect();
  restoreBackground();
  restoreMemberstackHosts();
  const scrollY = session?.scrollY ?? 0;
  const opener = session?.opener ?? null;
  if (opener) opener.setAttribute("aria-expanded", "false");
  unlockHelpHubToolPageScroll(scrollY);
  const restoreFocus = () => {
    window.scrollTo(0, scrollY);
    if (opener && typeof opener.focus === "function" && document.contains(opener)) {
      focusWithoutScroll(opener);
    }
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(restoreFocus);
  } else {
    restoreFocus();
  }
}

function openHelpHubToolModal(dialog: HTMLElement, opener: HTMLElement): void {
  if (activeDialog) return;
  const scrollY = lockHelpHubToolPageScroll();
  if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
  const observer = new MutationObserver(() => {
    inertBackground(dialog);
    raiseMemberstackHosts();
  });
  sessions.set(dialog, { opener, scrollY, observer });
  activeDialog = dialog;
  dialog.removeAttribute("hidden");
  inertBackground(dialog);
  raiseMemberstackHosts();
  observer.observe(document.body, { childList: true });
  opener.setAttribute("aria-expanded", "true");
  const scroller = dialog.querySelector<HTMLElement>(HELP_HUB_TOOL_BODY_SELECTOR);
  if (scroller) scroller.scrollTop = 0;
  const closeBtn = dialog.querySelector<HTMLElement>(HELP_HUB_TOOL_CLOSE_SELECTOR);
  focusWithoutScroll(closeBtn ?? dialog);
}

function onDocumentKeydown(event: KeyboardEvent): void {
  const dialog = activeDialog;
  if (!dialog) return;
  if (memberstackHasFocus()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeHelpHubToolModal(dialog);
    return;
  }
  trapHelpHubToolFocus(event, dialog);
}

function ensureKeydown(): void {
  if (keydownBound) return;
  keydownBound = true;
  document.addEventListener("keydown", onDocumentKeydown);
}

export function initHelpHubToolModals(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(HELP_HUB_TOOL_HOST_SELECTOR).forEach((host) => {
    if (host.getAttribute(BOUND_ATTR) === "true") return;
    const dialog = host.querySelector<HTMLElement>(HELP_HUB_TOOL_MODAL_SELECTOR);
    const opener = host.querySelector<HTMLElement>(HELP_HUB_TOOL_OPEN_SELECTOR);
    if (!dialog || !opener) return;
    host.setAttribute(BOUND_ATTR, "true");
    if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;

    opener.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (typeof event.button === "number" && event.button !== 0) return;
      event.preventDefault();
      openHelpHubToolModal(dialog, opener);
    });

    dialog.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(HELP_HUB_TOOL_CLOSE_SELECTOR)) {
        event.preventDefault();
        closeHelpHubToolModal(dialog);
        return;
      }
      if (target.closest("[data-ms-modal]")) raiseMemberstackHosts();
      if (target === dialog) closeHelpHubToolModal(dialog);
    });
  });

  ensureKeydown();
}
