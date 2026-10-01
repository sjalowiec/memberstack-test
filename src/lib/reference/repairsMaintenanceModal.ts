/**
 * Basic Machine Maintenance dialog on /reference/repairs.
 * Native <dialog> supplies the modal layer; this wires Close, Escape,
 * focus trapping, and focus return to the trigger.
 */

export const REPAIRS_MAINTENANCE_DIALOG_SELECTOR = "[data-repairs-maintenance-modal]";
export const REPAIRS_MAINTENANCE_OPEN_SELECTOR = "[data-repairs-maintenance-open]";
export const REPAIRS_MAINTENANCE_CLOSE_SELECTOR = "[data-repairs-maintenance-close]";

const BOUND_ATTR = "data-repairs-maintenance-bound";

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

export function repairsMaintenanceFocusable(dialog: ParentNode): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[hidden]")) return false;
    return true;
  });
}

/** Keep Tab and Shift+Tab inside the open dialog. */
export function trapRepairsMaintenanceFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = repairsMaintenanceFocusable(dialog);
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

export function initRepairsMaintenanceModal(root: ParentNode = document): void {
  const dialog = root.querySelector(REPAIRS_MAINTENANCE_DIALOG_SELECTOR);
  if (!isDialogElement(dialog) || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  let opener: HTMLElement | null = null;
  let previousOverflow = "";

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  const focusClose = (): void => {
    const closeBtn = dialog.querySelector<HTMLElement>(REPAIRS_MAINTENANCE_CLOSE_SELECTOR);
    const target = closeBtn ?? repairsMaintenanceFocusable(dialog)[0];
    target?.focus();
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

  dialog.querySelectorAll(REPAIRS_MAINTENANCE_CLOSE_SELECTOR).forEach((el) => {
    el.addEventListener("click", () => close());
  });

  dialog.addEventListener("keydown", (event) => {
    if (!dialog.open) return;
    trapRepairsMaintenanceFocus(event, dialog);
  });

  root.querySelectorAll(REPAIRS_MAINTENANCE_OPEN_SELECTOR).forEach((el) => {
    el.addEventListener("click", () => {
      if (!(el instanceof HTMLElement) || dialog.open) return;
      opener = el;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
      focusClose();
    });
  });
}
