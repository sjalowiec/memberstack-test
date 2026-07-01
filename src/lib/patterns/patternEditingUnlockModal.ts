import {
  canEditPatternSettingsForSystem,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import {
  resolvePatternSystemForEntitlement,
  type PatternSystemId,
} from "./patternSystemId";
import { logPatternEditGateDebug } from "./patternEditGateDebug";

export const PATTERN_EDITING_UNLOCK_EDIT_BUTTON_TOOLTIP =
  "Pattern editing is included with membership. You can still view, print, and rename this pattern.";

export const PATTERN_EDITING_UNLOCK_MODAL_TITLE = "Unlock pattern editing";
export const PATTERN_EDITING_UNLOCK_MODAL_BODY_LEAD =
  "You can still view, print, rename, and use this pattern.";
export const PATTERN_EDITING_UNLOCK_MODAL_BODY_DETAIL =
  "Editing is included with membership. To change the gauge, measurements, size, or style choices, unlock the full pattern system.";
export const PATTERN_EDITING_UNLOCK_MODAL_KEEP_LABEL = "Keep using this pattern";
export const PATTERN_EDITING_UNLOCK_MODAL_MEMBERSHIP_LABEL = "See membership options";
export const PATTERN_EDITING_UNLOCK_MODAL_MEMBERSHIP_HREF = "/membership";
export const PATTERN_EDITING_UNLOCK_MODAL_DISMISSED_SESSION_KEY =
  "kbm-pattern-editing-unlock-modal-dismissed";

const MODAL_SELECTOR = "[data-pattern-editing-unlock-modal]";
const BOUND_ATTR = "data-pattern-editing-unlock-modal-bound";
const INTERCEPTS_BOUND_ATTR = "data-pattern-editing-unlock-intercepts-bound";

const LOCKED_EDITING_CLICK_SELECTOR =
  '[data-cb-customize-entitlement-locked="true"], [data-tab="custom"].kbm-customize-tab--locked';

export function isPatternEditingUnlockModalDismissedForSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(PATTERN_EDITING_UNLOCK_MODAL_DISMISSED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissPatternEditingUnlockModalForSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PATTERN_EDITING_UNLOCK_MODAL_DISMISSED_SESSION_KEY, "true");
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Logged-in knitters who may view/print/rename but not edit pattern settings. */
export function shouldOfferPatternEditingUnlockModal(
  access: SleevelessUserAccess | null | undefined,
  patternSystem?: PatternSystemId,
): boolean {
  const system =
    patternSystem ??
    (typeof document !== "undefined" ? resolvePatternSystemForEntitlement() : "sleeveless");
  return Boolean(access?.loggedIn && !canEditPatternSettingsForSystem(access, system));
}

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root?: ParentNode): HTMLDialogElement | null {
  if (typeof document === "undefined") return null;
  const scopes: ParentNode[] = [];
  if (root && typeof root.querySelector === "function") scopes.push(root);
  if (typeof document.querySelector === "function") scopes.push(document);
  for (const scope of scopes) {
    const el = scope.querySelector(MODAL_SELECTOR);
    if (isDialogElement(el)) return el;
  }
  return null;
}

function closePatternEditingUnlockModal(dialog: HTMLDialogElement): void {
  if (dialog.open) dialog.close();
}

/** Shows the unlock modal when allowed. Returns true when the modal was shown. */
export function showPatternEditingUnlockModal(options?: {
  force?: boolean;
  root?: ParentNode;
}): boolean {
  if (!options?.force && isPatternEditingUnlockModalDismissedForSession()) return false;

  const dialog = getDialog(options?.root);
  if (!dialog || typeof dialog.showModal !== "function") return false;

  dialog.showModal();
  return true;
}

/**
 * When the knitter lacks edit access, show the unlock modal for a deliberate action
 * (Edit, Copy, locked customize control). Always re-opens even if they dismissed the
 * auto-prompt earlier in the session.
 */
export function offerPatternEditingUnlockModal(
  access: SleevelessUserAccess | null | undefined,
  options?: { root?: ParentNode; patternSystem?: PatternSystemId },
): boolean {
  const shouldOffer = shouldOfferPatternEditingUnlockModal(access, options?.patternSystem);
  logPatternEditGateDebug("offerPatternEditingUnlockModal", {
    patternSystem: options?.patternSystem,
    hasSystemAccess: access?.hasSystemAccess,
    freeClaimsBySystem: access?.freeClaimsBySystem,
    drawerAllowed: false,
    extra: { shouldOffer },
  });
  if (!shouldOffer) return false;
  const shown = showPatternEditingUnlockModal({ ...options, force: true });
  logPatternEditGateDebug("showPatternEditingUnlockModal", {
    patternSystem: options?.patternSystem,
    extra: { shown },
  });
  return shown;
}

/** Keep Edit visible but clearly locked; click handlers show {@link offerPatternEditingUnlockModal}. */
export function applyLockedPatternEditButtonState(
  button: HTMLElement | null | undefined,
  locked: boolean,
  tooltip = PATTERN_EDITING_UNLOCK_EDIT_BUTTON_TOOLTIP,
): void {
  if (!button) return;
  button.hidden = false;
  button.removeAttribute("aria-hidden");
  button.removeAttribute("tabindex");
  button.classList.toggle("is-disabled", locked);
  if (locked) {
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("title", tooltip);
  } else {
    button.removeAttribute("aria-disabled");
    button.removeAttribute("title");
  }
}

/** Wire dismiss controls once per dialog instance. */
export function initPatternEditingUnlockModal(root: ParentNode = document): void {
  const dialog = getDialog(root);
  if (!dialog || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  const dismiss = (): void => {
    dismissPatternEditingUnlockModalForSession();
    closePatternEditingUnlockModal(dialog);
  };

  dialog.querySelectorAll("[data-pattern-editing-unlock-dismiss]").forEach((el) => {
    el.addEventListener("click", dismiss);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismiss();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
}

/** Auto-open on gated pattern workspace load (once per session after dismiss). */
export function maybeShowPatternEditingUnlockModalOnWorkspaceLoad(
  access: SleevelessUserAccess,
  options?: { root?: ParentNode; patternSystem?: PatternSystemId },
): boolean {
  if (!shouldOfferPatternEditingUnlockModal(access, options?.patternSystem)) return false;
  return showPatternEditingUnlockModal(options);
}

/** Offer the modal when a locked customize/edit control is clicked. */
export function wirePatternEditingUnlockClickIntercepts(root: ParentNode = document): void {
  if (typeof document === "undefined") return;
  const host = root instanceof Document ? root.documentElement : root;
  if (!(host instanceof HTMLElement) || host.getAttribute(INTERCEPTS_BOUND_ATTR) === "true") {
    return;
  }
  host.setAttribute(INTERCEPTS_BOUND_ATTR, "true");

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const lockedControl = target.closest(LOCKED_EDITING_CLICK_SELECTOR);
    if (!lockedControl) return;
    event.preventDefault();
    showPatternEditingUnlockModal({ force: true });
  });
}
