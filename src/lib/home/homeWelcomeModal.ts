/**
 * One-time homepage welcome modal for the rebuilt Knit It Now site.
 * Mount only from `src/pages/index.astro` ù never from Layout/BaseLayout.
 */

export const HOME_WELCOME_MODAL_STORAGE_KEY = "kin-home-welcome-modal-dismissed";

export const HOME_WELCOME_MODAL_TITLE = "Welcome to the New Knit It Now";
export const HOME_WELCOME_MODAL_BODY =
  "Knit It Now has been completely rebuilt. You do not need to log in to browse the public areas of the website. Current members can log in to access member-only patterns and resources.";
export const HOME_WELCOME_MODAL_PRIMARY_LABEL = "Read About the New Site";
export const HOME_WELCOME_MODAL_PRIMARY_HREF = "/new-site";
export const HOME_WELCOME_MODAL_SECONDARY_LABEL = "Explore the New Knit it Now";

const ROOT_SELECTOR = "[data-home-welcome-modal]";
const DIALOG_SELECTOR = "[data-home-welcome-dialog]";
const CLOSE_SELECTOR = "[data-home-welcome-close]";
const PRIMARY_SELECTOR = "[data-home-welcome-primary]";
const SECONDARY_SELECTOR = "[data-home-welcome-secondary]";
const BOUND_ATTR = "data-home-welcome-modal-bound";
const OPEN_CLASS = "is-open";

let previousFocus: HTMLElement | null = null;

export function hasDismissedHomeWelcomeModal(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(HOME_WELCOME_MODAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissHomeWelcomeModal(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(HOME_WELCOME_MODAL_STORAGE_KEY, "true");
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function shouldShowHomeWelcomeModal(): boolean {
  return !hasDismissedHomeWelcomeModal();
}

function getRoot(scope: ParentNode = document): HTMLElement | null {
  const el = scope.querySelector(ROOT_SELECTOR);
  return el instanceof HTMLElement ? el : null;
}

function getDialog(root: HTMLElement): HTMLElement | null {
  const el = root.querySelector(DIALOG_SELECTOR);
  return el instanceof HTMLElement ? el : null;
}

function isOpen(root: HTMLElement): boolean {
  return root.classList.contains(OPEN_CLASS);
}

function focusFirstControl(root: HTMLElement): void {
  const closeBtn = root.querySelector<HTMLElement>(CLOSE_SELECTOR);
  const focusTarget =
    closeBtn ??
    root.querySelector<HTMLElement>(PRIMARY_SELECTOR) ??
    getDialog(root);
  focusTarget?.focus();
}

export function openHomeWelcomeModal(root?: ParentNode): boolean {
  const modalRoot = getRoot(root);
  if (!modalRoot || isOpen(modalRoot)) return false;

  const active = document.activeElement;
  previousFocus = active instanceof HTMLElement ? active : null;

  modalRoot.classList.add(OPEN_CLASS);
  modalRoot.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  focusFirstControl(modalRoot);
  return true;
}

export function closeHomeWelcomeModal(options?: {
  root?: ParentNode;
  dismiss?: boolean;
}): void {
  const modalRoot = getRoot(options?.root);
  if (!modalRoot || !isOpen(modalRoot)) return;

  if (options?.dismiss !== false) {
    dismissHomeWelcomeModal();
  }

  modalRoot.classList.remove(OPEN_CLASS);
  modalRoot.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  const restore = previousFocus;
  previousFocus = null;
  if (restore && typeof restore.focus === "function" && document.contains(restore)) {
    restore.focus();
  } else {
    const main = document.querySelector<HTMLElement>("main a, main button, main [href]");
    main?.focus?.();
  }
}

/** Open on first homepage visit when the dismiss flag is not set. */
export function maybeOpenHomeWelcomeModal(root?: ParentNode): boolean {
  if (!shouldShowHomeWelcomeModal()) return false;
  return openHomeWelcomeModal(root);
}

/** Wire controls once; auto-opens when not previously dismissed. */
export function initHomeWelcomeModal(root: ParentNode = document): void {
  const modalRoot = getRoot(root);
  if (!modalRoot || modalRoot.getAttribute(BOUND_ATTR) === "true") return;
  modalRoot.setAttribute(BOUND_ATTR, "true");

  const dismissAndClose = (): void => {
    closeHomeWelcomeModal({ root, dismiss: true });
  };

  modalRoot.querySelectorAll(CLOSE_SELECTOR).forEach((el) => {
    el.addEventListener("click", dismissAndClose);
  });

  modalRoot.querySelectorAll(SECONDARY_SELECTOR).forEach((el) => {
    el.addEventListener("click", dismissAndClose);
  });

  modalRoot.querySelectorAll(PRIMARY_SELECTOR).forEach((el) => {
    el.addEventListener("click", () => {
      dismissHomeWelcomeModal();
    });
  });

  modalRoot.addEventListener("click", (event) => {
    if (event.target === modalRoot) dismissAndClose();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen(modalRoot)) {
      event.preventDefault();
      dismissAndClose();
    }
  });

  maybeOpenHomeWelcomeModal(root);
}
