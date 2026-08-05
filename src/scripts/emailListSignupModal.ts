/**
 * Tip of the Week email signup modal + CTA presentation.
 * Does not call ActiveCampaign on page load. Server signup path unchanged.
 */

import { isMemberstackLoggedInPayload } from "../lib/patterns/memberstackMember";
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
const DELEGATED_ATTR = "data-weekly-tip-signup-delegated";
const BOOT_ATTR = "data-weekly-tip-signup-boot";
const MS_AUTH_ATTR = "data-weekly-tip-signup-ms-auth";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export type ResolveWeeklyTipMemberstackLoggedIn = () => Promise<boolean>;

/**
 * Pure visibility rule:
 * - show for logged-out unrecognized visitors
 * - hide for recognized email subscribers
 * - hide for logged-in Memberstack members (regardless of localStorage)
 */
export function shouldShowWeeklyTipSignupChrome(args: {
  recognizedSubscriber: boolean;
  memberstackLoggedIn: boolean;
}): boolean {
  return !args.recognizedSubscriber && !args.memberstackLoggedIn;
}

async function defaultResolveMemberstackLoggedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  for (let i = 0; i < 30; i++) {
    const ms = window.$memberstackDom;
    const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
    if (ms && typeof api === "function") {
      try {
        const onReady = ms.onReady;
        if (onReady && typeof (onReady as Promise<unknown>).then === "function") {
          await Promise.race([
            Promise.resolve(onReady).catch(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, 4000)),
          ]);
        }
        const payload = await api.call(ms);
        return isMemberstackLoggedInPayload(payload);
      } catch {
        return false;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

let resolveMemberstackLoggedIn: ResolveWeeklyTipMemberstackLoggedIn =
  defaultResolveMemberstackLoggedIn;
/** Cached Memberstack session flag; updated after Memberstack is ready / on login/logout. */
let memberstackLoggedIn = false;

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
  const recognizedSubscriber = isWeeklyTipSubscriberRecognized(now);
  setWeeklyTipSignupChromeVisible(
    shouldShowWeeklyTipSignupChrome({
      recognizedSubscriber,
      memberstackLoggedIn,
    }),
    root,
  );
}

function chromeAllowsOpen(now?: number): boolean {
  return shouldShowWeeklyTipSignupChrome({
    recognizedSubscriber: isWeeklyTipSubscriberRecognized(now),
    memberstackLoggedIn,
  });
}

export async function refreshWeeklyTipSignupMemberstackState(
  root: ParentNode = document,
): Promise<boolean> {
  try {
    memberstackLoggedIn = await resolveMemberstackLoggedIn();
  } catch {
    memberstackLoggedIn = false;
  }
  syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
  return memberstackLoggedIn;
}

function bindWeeklyTipSignupMemberstackListeners(root: ParentNode): void {
  if (typeof window === "undefined") return;
  const host =
    typeof document !== "undefined" ? document.documentElement : null;
  if (host?.getAttribute(MS_AUTH_ATTR) === "true") return;

  const ms = window.$memberstackDom;
  if (!ms || typeof ms.on !== "function") return;
  if (host) host.setAttribute(MS_AUTH_ATTR, "true");

  ms.on("member.login", () => {
    memberstackLoggedIn = true;
    syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
    void refreshWeeklyTipSignupMemberstackState(root);
  });
  ms.on("member.logout", () => {
    memberstackLoggedIn = false;
    syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
    void refreshWeeklyTipSignupMemberstackState(root);
  });
}

/**
 * Idempotent Memberstack wiring: resolve session after onReady, then keep chrome
 * in sync on login/logout. Logged-out visitors keep the CTA until/unless recognized.
 * defaultResolve already waits (bounded) for `$memberstackDom` before deciding.
 */
export function ensureWeeklyTipSignupMemberstackAuth(
  root: ParentNode = document,
): void {
  if (typeof window === "undefined") return;

  void (async () => {
    await refreshWeeklyTipSignupMemberstackState(root);
    bindWeeklyTipSignupMemberstackListeners(root);
  })();
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

/** Rebuild open/close without attaching more listeners (dialog already bound). */
function createControllerForBoundDialog(
  dialog: HTMLDialogElement,
  root: ParentNode,
): WeeklyTipSignupModalController {
  const open = (opener?: HTMLElement | null): void => {
    syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
    if (!chromeAllowsOpen(activeOptions.now)) return;
    void opener;
    if (!isSuccessVisible(dialog)) {
      restoreFormView(dialog);
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    const focusTarget =
      dialog.querySelector<HTMLElement>("[data-signup-close]") ||
      dialog.querySelector<HTMLElement>('input[name="firstName"]') ||
      getFocusable(dialog)[0];
    focusTarget?.focus();
  };

  return {
    open,
    close: () => {
      if (dialog.open) dialog.close();
    },
    isOpen: () => dialog.open,
  };
}

type InitOptions = {
  now?: number;
  locationLike?: {
    pathname: string;
    search: string;
    hash: string;
  };
  replaceState?: (url: string) => void;
};

let activeController: WeeklyTipSignupModalController | null = null;
let activeOptions: InitOptions = {};

/**
 * Wire the dialog once. Safe to call repeatedly — skips duplicate listeners via BOUND_ATTR.
 * Returns null when the dialog is not in the DOM yet (caller may retry after DOM ready).
 */
export function initWeeklyTipSignupModal(
  root: ParentNode = document,
  options: InitOptions = {},
): WeeklyTipSignupModalController | null {
  const dialog = getDialog(root);
  if (!dialog) return null;

  activeOptions = { ...activeOptions, ...options };

  if (dialog.getAttribute(BOUND_ATTR) === "true") {
    syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
    ensureWeeklyTipSignupMemberstackAuth(root);
    if (activeController) return activeController;
    // Module singleton was lost (e.g. remount) but listeners already exist —
    // rebuild the controller without attaching duplicate handlers.
    activeController = createControllerForBoundDialog(dialog, root);
    return activeController;
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

  // Keep CTA visible for logged-out visitors on first paint; Memberstack may hide it shortly after.
  syncWeeklyTipSignupChromeVisibility(root, options.now);
  ensureWeeklyTipSignupMemberstackAuth(root);

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
    // Recover chrome visibility if recognition / auth flipped after first paint.
    syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
    if (!chromeAllowsOpen(activeOptions.now)) return;

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

  root.addEventListener("email-list-signup:success", ((event: CustomEvent) => {
    markWeeklyTipSubscriberRecognized(activeOptions.now);
    syncWeeklyTipSignupChromeVisibility(root, activeOptions.now);
    const doneBtn = dialog.querySelector<HTMLElement>("[data-signup-done]");
    if (doneBtn) {
      doneBtn.hidden = false;
      doneBtn.focus();
    }
    void event;
  }) as EventListener);

  activeController = { open, close, isOpen: () => dialog.open };
  return activeController;
}

/**
 * Document-level open-button delegation (idempotent). Survives timing where
 * per-button listeners were never attached, and works after DOM swaps.
 */
export function ensureWeeklyTipSignupOpenDelegation(
  doc: Document = document,
): void {
  const host = doc.documentElement;
  if (!host || host.getAttribute(DELEGATED_ATTR) === "true") return;
  host.setAttribute(DELEGATED_ATTR, "true");

  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof (target as { closest?: unknown }).closest !== "function") {
      return;
    }
    const btn = (target as Element).closest<HTMLElement>(WEEKLY_TIP_SIGNUP_OPEN_SELECTOR);
    if (!btn) return;

    event.preventDefault();

    const controller =
      activeController ??
      initWeeklyTipSignupModal(doc, activeOptions);
    if (!controller) return;
    controller.open(btn);
  });
}

/**
 * Boot entry used by the Astro page script.
 * - Waits for DOMContentLoaded when the dialog is not ready yet
 * - Re-runs on astro:page-load when present
 * - Uses delegated clicks so triggers always work once the dialog exists
 * - Resolves Memberstack after load so logged-in members hide the CTA
 */
export function bootWeeklyTipSignupModal(
  options: InitOptions = {},
  doc: Document = document,
): WeeklyTipSignupModalController | null {
  activeOptions = { ...activeOptions, ...options };
  ensureWeeklyTipSignupOpenDelegation(doc);

  const run = (): WeeklyTipSignupModalController | null => {
    const controller = initWeeklyTipSignupModal(doc, activeOptions);
    ensureWeeklyTipSignupMemberstackAuth(doc);
    return controller;
  };

  let controller = run();

  if (!controller && doc.readyState === "loading") {
    doc.addEventListener(
      "DOMContentLoaded",
      () => {
        controller = run();
      },
      { once: true },
    );
  }

  if (typeof document !== "undefined" && document.documentElement) {
    const rootEl = document.documentElement;
    if (rootEl.getAttribute(BOOT_ATTR) !== "true") {
      rootEl.setAttribute(BOOT_ATTR, "true");
      document.addEventListener("astro:page-load", () => {
        // Client navigation may swap markup; re-init if a fresh unbound dialog appears.
        run();
      });
    }
  }

  return controller;
}

/** Test helper: reset module singletons between cases. */
export function resetWeeklyTipSignupModalForTests(): void {
  activeController = null;
  activeOptions = {};
  memberstackLoggedIn = false;
  resolveMemberstackLoggedIn = defaultResolveMemberstackLoggedIn;
}

/** Test helper: inject Memberstack logged-in resolution. */
export function setWeeklyTipSignupMemberstackResolverForTests(
  resolver?: ResolveWeeklyTipMemberstackLoggedIn,
): void {
  resolveMemberstackLoggedIn = resolver ?? defaultResolveMemberstackLoggedIn;
}

/** Test helper: set cached Memberstack logged-in flag directly. */
export function setWeeklyTipSignupMemberstackLoggedInForTests(value: boolean): void {
  memberstackLoggedIn = value;
}
