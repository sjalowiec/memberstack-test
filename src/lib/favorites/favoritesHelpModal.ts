/**
 * “How to save favorites” dialog on the account page.
 * Native <dialog> supplies the modal layer; this wires Close, Escape,
 * backdrop click, focus trapping, and focus return to the help link.
 * The demonstration GIF is requested only when the dialog opens.
 */

export const FAVORITES_HELP_DEMO_SRC = "/images/help/favorites.gif";
export const FAVORITES_HELP_DIALOG_SELECTOR = "[data-favorites-help-modal]";
export const FAVORITES_HELP_OPEN_SELECTOR = "[data-favorites-help-open]";
export const FAVORITES_HELP_CLOSE_SELECTOR = "[data-favorites-help-close]";
export const FAVORITES_HELP_DEMO_SELECTOR = "[data-favorites-help-demo]";
export const FAVORITES_HELP_MISSING_SELECTOR = "[data-favorites-help-missing]";

const BOUND_ATTR = "data-favorites-help-bound";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

export function favoritesHelpFocusable(dialog: ParentNode): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[hidden]")) return false;
    return true;
  });
}

/** Keep Tab and Shift+Tab inside the open dialog. */
export function trapFavoritesHelpFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = favoritesHelpFocusable(dialog);
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

function loadFavoritesHelpDemo(dialog: HTMLElement): void {
  const img = dialog.querySelector<HTMLImageElement>(FAVORITES_HELP_DEMO_SELECTOR);
  const missing = dialog.querySelector<HTMLElement>(FAVORITES_HELP_MISSING_SELECTOR);
  if (!img) return;
  if (img.getAttribute("src") === FAVORITES_HELP_DEMO_SRC && img.dataset.favoritesHelpLoaded === "true") {
    return;
  }

  missing?.setAttribute("hidden", "");
  img.hidden = true;

  const onLoad = (): void => {
    img.dataset.favoritesHelpLoaded = "true";
    img.hidden = false;
    missing?.setAttribute("hidden", "");
  };
  const onError = (): void => {
    img.removeAttribute("src");
    delete img.dataset.favoritesHelpLoaded;
    img.hidden = true;
    if (missing) missing.hidden = false;
  };

  img.addEventListener("load", onLoad, { once: true });
  img.addEventListener("error", onError, { once: true });
  img.src = FAVORITES_HELP_DEMO_SRC;
}

export function initFavoritesHelpModal(root: ParentNode = document): void {
  const dialog = root.querySelector(FAVORITES_HELP_DIALOG_SELECTOR);
  if (!isDialogElement(dialog) || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  let opener: HTMLElement | null = null;
  let previousOverflow = "";

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  const focusClose = (): void => {
    const closeBtn = dialog.querySelector<HTMLElement>(FAVORITES_HELP_CLOSE_SELECTOR);
    const target = closeBtn ?? favoritesHelpFocusable(dialog)[0];
    target?.focus();
  };

  const openFrom = (trigger: HTMLElement): void => {
    if (dialog.open) return;
    opener = trigger;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    loadFavoritesHelpDemo(dialog);
    dialog.showModal();
    focusClose();
  };

  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    const restore = opener;
    opener = null;
    if (restore && typeof restore.focus === "function" && document.contains(restore)) {
      restore.focus();
    }
  });

  dialog.addEventListener("cancel", () => {
    /* Native Escape closes the dialog; the close listener returns focus. */
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.querySelectorAll(FAVORITES_HELP_CLOSE_SELECTOR).forEach((el) => {
    el.addEventListener("click", () => close());
  });

  dialog.addEventListener("keydown", (event) => {
    if (!dialog.open) return;
    trapFavoritesHelpFocus(event, dialog);
  });

  root.querySelectorAll(FAVORITES_HELP_OPEN_SELECTOR).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFrom(el);
    });
  });
}
