/**
 * Tip of the Week email signup modal + CTA presentation.
 * Does not call ActiveCampaign on page load. Server signup path unchanged.
 */

import {
  applyWeeklyTipSubscriberQueryHint,
  isWeeklyTipSubscriberRecognized,
  markWeeklyTipSubscriberRecognized,
} from "../lib/email/weeklyTipSubscriberHint";
import { initEmailListSignupForms } from "./emailListSignupForm";

export const WEEKLY_TIP_SIGNUP_MODAL_SELECTOR = "[data-weekly-tip-signup-modal]";
export const WEEKLY_TIP_SIGNUP_OPEN_SELECTOR = "[data-weekly-tip-signup-open]";
export const WEEKLY_TIP_SIGNUP_CHROME_SELECTOR = "[data-weekly-tip-signup-chrome]";

const BOUND_ATTR = "data-weekly-tip-signup-bound";
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

function getDialog(root: ParentNode): HTMLDialogElement | null {
  const el = root.querySelector(WEEKLY_TIP_SIGNUP_MODAL_SELECTOR);
  return isDialogElement(el) ? el : null;
}

function formHasEnteredValues(dialog: HTMLDialogElement): boolean {
  const firstName = dialog.querySelector<HTMLInputElement>('input[name="firstName"]');
  const email = dialog.querySelector<HTMLInputElement>('input[name="email"]');
  return Boolean(firstName?.value.trim() || email?.value.trim());
}

function isSuccessVisible(dialog: HTMLDialogElement): boolean {
  const thanks = dialog.querySelector<HTMLElement>("[data-signup-thanks]");
  return Boolean(thanks && !thanks.hidden);
}

function getFocusable(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

export function setWeeklyTipSignupChromeVisible(
  visible: boolean,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLElement>(WEEKLY_TIP_SIGNUP_CHROME_SELECTOR).forEach((el) => {
    el.hidden = !visible;
    if (visible) {
      el.removeAttribute("aria-hidden");
    } else {
      el.setAttribute("aria-hidden", "true");
    }
  });
}

export function syncWeeklyTipSignupChromeVisibility(
  root: ParentNode = document,
  now: number = Date.now(),
): void {
  const recognized = isWeeklyTipSubscriberRecognized(now);
  setWeeklyTipSignupChromeVisible(!recognized, root);
}

function restoreFormView(dialog: HTMLDialogElement): void {
  const form = dialog.querySelector<HTMLFormElement>("[data-email-list-signup]");
  const thanks = dialog.querySelector<HTMLElement>("[data-signup-thanks]");
  const errorEl = dialog.querySelector<HTMLElement>("[data-signup-error]");
  const doneBtn = dialog.querySelector<HTMLElement>("[data-signup-done]");
  if (form) {
    form.hidden = false;
    form.dataset.submitting = "false";
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = false;
  }
  if (thanks) thanks.hidden = true;
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }
  if (doneBtn) doneBtn.hidden = true;
}

export type WeeklyTipSignupModalController = {
  open: (opener?: HTMLElement | null) => void;
  close: () => void;
  isOpen: () => boolean;
};

export function initWeeklyTipSignupModal(
  root: ParentNode = document,
  options: {
    now?: number;
    locationLike?: {
      pathname: string;
      search: string;
      hash: string;
    };
    replaceState?: (url: string) => void;
  } = {},
): WeeklyTipSignupModalController | null {
  const dialog = getDialog(root);
  if (!dialog) return null;
  if (dialog.getAttribute(BOUND_ATTR) === "true") {
    return {
      open: () => {
        if (!dialog.open) dialog.showModal();
      },
      close: () => {
        if (dialog.open) dialog.close();
      },
      isOpen: () => dialog.open,
    };
  }
  dialog.setAttribute(BOUND_ATTR, "true");

  // Presentation hint from ActiveCampaign email links — never auth.
  const loc =
    options.locationLike ??
    (typeof window !== "undefined"
      ? {
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
        }
      : null);
  if (loc) {
    applyWeeklyTipSubscriberQueryHint({
      pathname: loc.pathname,
      search: loc.search,
      hash: loc.hash,
      now: options.now,
      replaceState: options.replaceState,
    });
  }

  syncWeeklyTipSignupChromeVisibility(root, options.now);

  initEmailListSignupForms(root);

  let lastOpener: HTMLElement | null = null;
  let previousBodyOverflow = "";

  const lockScroll = (): void => {
    if (typeof document === "undefined") return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  };

  const unlockScroll = (): void => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = previousBodyOverflow;
  };

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  const open = (opener?: HTMLElement | null): void => {
    if (isWeeklyTipSubscriberRecognized(options.now)) return;
    lastOpener = opener ?? null;
    if (!isSuccessVisible(dialog)) {
      restoreFormView(dialog);
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    lockScroll();
    const focusTarget =
      dialog.querySelector<HTMLElement>("[data-signup-close]") ||
      dialog.querySelector<HTMLElement>('input[name="firstName"]') ||
      getFocusable(dialog)[0];
    focusTarget?.focus();
  };

  dialog.addEventListener("close", () => {
    unlockScroll();
    if (lastOpener && typeof lastOpener.focus === "function") {
      lastOpener.focus();
    }
  });

  // Escape: native dialog fires "cancel"; allow close (required).
  dialog.addEventListener("cancel", () => {
    // Let the dialog close; scroll unlock handled by "close".
  });

  // Backdrop click: do not discard entered field values accidentally.
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    if (isSuccessVisible(dialog)) {
      close();
      return;
    }
    if (formHasEnteredValues(dialog)) {
      return;
    }
    close();
  });

  dialog.querySelectorAll("[data-signup-close], [data-signup-done]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
    });
  });

  // Focus trap (reinforces native dialog behavior for older engines / tests).
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !dialog.open) return;
    const focusable = getFocusable(dialog);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  root.querySelectorAll<HTMLElement>(WEEKLY_TIP_SIGNUP_OPEN_SELECTOR).forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      open(btn);
    });
  });

  root.addEventListener("email-list-signup:success", ((event: CustomEvent) => {
    markWeeklyTipSubscriberRecognized(options.now);
    syncWeeklyTipSignupChromeVisibility(root, options.now);
    const doneBtn = dialog.querySelector<HTMLElement>("[data-signup-done]");
    if (doneBtn) {
      doneBtn.hidden = false;
      doneBtn.focus();
    }
    void event;
  }) as EventListener);

  return { open, close, isOpen: () => dialog.open };
}
